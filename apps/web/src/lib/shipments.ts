import { type Db, getDb, schema } from "@ormaro/db";
import { cities, type CourierKey, couriers } from "@ormaro/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { isBlockedEitherWay } from "./blocks";

const { shipments, conversations, listings, messages } = schema;

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

export type Shipment = typeof shipments.$inferSelect;

/** Sohbetteki son kargo kaydı (iptal edilmiş olsa da). */
export async function shipmentForConversation(conversationId: string): Promise<Shipment | null> {
  const [row] = await db()
    .select()
    .from(shipments)
    .where(eq(shipments.conversationId, conversationId))
    .orderBy(desc(shipments.createdAt))
    .limit(1);
  return row ?? null;
}

export type RequestInput = {
  recipientName: string;
  phone: string;
  cityKey: string;
  address: string;
  note: string;
};

export type RequestError = "notAllowed" | "exists" | "name" | "phone" | "city" | "address";

export function validateRequest(i: RequestInput): RequestError | null {
  if (i.recipientName.length < 3 || i.recipientName.length > 80) return "name";
  // Karadağ ve yurt dışı numaraları: rakam, boşluk, +, -, / ve parantez; en az 6 rakam.
  if (!/^[+\d][\d\s\-/()]{5,24}$/.test(i.phone) || i.phone.replace(/\D/g, "").length < 6) return "phone";
  if (!cities.some((c) => c.key === i.cityKey)) return "city";
  if (i.address.length < 5 || i.address.length > 200) return "address";
  return null;
}

/**
 * Alıcı kargo ister. İlan kargoya açık ve aktif olmalı, sohbette bekleyen ya da
 * yoldaki bir gönderi olmamalı. Tutar kabul edilmiş son teklif, yoksa ilan fiyatıdır.
 */
export async function requestShipment(
  conversationId: string,
  buyerId: string,
  input: RequestInput,
): Promise<{ id: string; sellerId: string } | { error: RequestError }> {
  const invalid = validateRequest(input);
  if (invalid) return { error: invalid };
  const [c] = await db()
    .select({
      buyerId: conversations.buyerId,
      sellerId: conversations.sellerId,
      listingId: listings.id,
      status: listings.status,
      shipping: listings.shipping,
      price: listings.priceEuro,
    })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!c || c.buyerId !== buyerId || c.status !== "active" || c.shipping === "none") return { error: "notAllowed" };
  if (await isBlockedEitherWay(buyerId, c.sellerId)) return { error: "notAllowed" };
  const current = await shipmentForConversation(conversationId);
  if (current && (current.status === "requested" || current.status === "shipped")) return { error: "exists" };

  const [accepted] = await db()
    .select({ amount: messages.offerEuro })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.offerStatus, "accepted")))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const [row] = await db()
    .insert(shipments)
    .values({
      conversationId,
      listingId: c.listingId,
      buyerId,
      sellerId: c.sellerId,
      amountEuro: accepted?.amount ?? c.price,
      shippingPayer: c.shipping,
      ...input,
    })
    .returning({ id: shipments.id });
  await db().update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
  return { id: row!.id, sellerId: c.sellerId };
}

/** Satıcı paketi kargoya verdi: firma ve takip numarası kaydedilir, ilan satıldı olur. */
export async function markShipped(
  shipmentId: string,
  sellerId: string,
  courierKey: CourierKey,
  courierName: string,
  trackingNumber: string,
) {
  const known = couriers.find((c) => c.key === courierKey);
  if (!known) return null;
  const name = courierKey === "other" ? courierName.trim().slice(0, 60) : known.name;
  const tracking = trackingNumber.trim().slice(0, 60);
  if (!name || tracking.length < 3) return null;
  return db().transaction(async (tx) => {
    const [s] = await tx
      .update(shipments)
      .set({ status: "shipped", courierKey, courierName: name, trackingNumber: tracking, shippedAt: new Date() })
      .where(and(eq(shipments.id, shipmentId), eq(shipments.sellerId, sellerId), eq(shipments.status, "requested")))
      .returning();
    if (!s) return null;
    await tx.update(listings).set({ status: "sold", updatedAt: new Date() }).where(eq(listings.id, s.listingId));
    await tx.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, s.conversationId));
    return s;
  });
}

/** Alıcı teslim aldığını onaylar. */
export async function markDelivered(shipmentId: string, buyerId: string) {
  const [s] = await db()
    .update(shipments)
    .set({ status: "delivered", deliveredAt: new Date() })
    .where(and(eq(shipments.id, shipmentId), eq(shipments.buyerId, buyerId), eq(shipments.status, "shipped")))
    .returning();
  return s ?? null;
}

/**
 * İptal: kargoya verilmeden önce iki taraf da iptal edebilir.
 * Kargoya verildikten sonra yalnızca satıcı iptal edebilir (ör. paket geri döndü);
 * o durumda ilan yeniden satışa açılır.
 */
export async function cancelShipment(shipmentId: string, userId: string) {
  return db().transaction(async (tx) => {
    const [s] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
    if (!s) return null;
    const isBuyer = s.buyerId === userId;
    const isSeller = s.sellerId === userId;
    const allowed = (s.status === "requested" && (isBuyer || isSeller)) || (s.status === "shipped" && isSeller);
    if (!allowed) return null;
    await tx
      .update(shipments)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(and(eq(shipments.id, s.id), inArray(shipments.status, ["requested", "shipped"])));
    if (s.status === "shipped") {
      await tx.update(listings).set({ status: "active", updatedAt: new Date() }).where(eq(listings.id, s.listingId));
    }
    return { ...s, cancelledBy: isBuyer ? ("buyer" as const) : ("seller" as const) };
  });
}
