import { type Db, getDb, schema } from "@ormaro/db";
import { aliasedTable, and, asc, count, desc, eq, isNull, ne, or, sql } from "drizzle-orm";

import type { Locale } from "@ormaro/shared";
import { titleIn } from "./listings";

const { conversations, messages, listings, users } = schema;

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

export const MAX_MESSAGE_LENGTH = 2000;

/** Alıcı ile ilan arasındaki sohbeti döner; yoksa oluşturur. Kendi ilanına sohbet açılamaz. */
export async function getOrCreateConversation(listingId: string, buyerId: string) {
  const [listing] = await db()
    .select({ sellerId: listings.sellerId, status: listings.status })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing || listing.status === "removed") return { error: "not_found" as const };
  if (listing.sellerId === buyerId) return { error: "own_listing" as const };

  await db()
    .insert(conversations)
    .values({ listingId, buyerId, sellerId: listing.sellerId })
    .onConflictDoNothing();
  const [row] = await db()
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.buyerId, buyerId)))
    .limit(1);
  return row ? { id: row.id } : { error: "not_found" as const };
}

export type ConversationRow = {
  id: string;
  role: "buyer" | "seller";
  otherName: string | null;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  listingStatus: "active" | "sold" | "removed";
  coverKey: string | null;
  lastMessageAt: Date;
  lastBody: string | null;
  lastKind: "text" | "offer" | null;
  lastOffer: number | null;
  lastFromMe: boolean;
  unread: number;
};

export async function listConversations(
  userId: string,
  filter: "all" | "buying" | "selling",
  locale: Locale,
): Promise<ConversationRow[]> {
  const other = aliasedTable(users, "other");
  const who =
    filter === "buying"
      ? eq(conversations.buyerId, userId)
      : filter === "selling"
        ? eq(conversations.sellerId, userId)
        : or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId));

  const rows = await db()
    .select({
      id: conversations.id,
      buyerId: conversations.buyerId,
      otherName: other.name,
      listingId: listings.id,
      listingTitle: titleIn(locale),
      listingPrice: listings.priceEuro,
      listingStatus: listings.status,
      lastMessageAt: conversations.lastMessageAt,
      coverKey: sql<string | null>`(select lp.url from listing_photos lp where lp.listing_id = "listings"."id" order by lp.position limit 1)`,
      last: sql<{ body: string; kind: "text" | "offer"; offer: number | null; sender: string } | null>`(
        select json_build_object('body', m.body, 'kind', m.kind, 'offer', m.offer_euro, 'sender', m.sender_id)
        from messages m where m.conversation_id = "conversations"."id"
        order by m.created_at desc limit 1)`,
      unread: sql<number>`(
        select count(*)::int from messages m
        where m.conversation_id = "conversations"."id" and m.sender_id <> ${userId} and m.read_at is null)`,
    })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .innerJoin(
      other,
      sql`${other.id} = case when ${conversations.buyerId} = ${userId} then ${conversations.sellerId} else ${conversations.buyerId} end`,
    )
    .where(and(who, sql`exists (select 1 from messages m where m.conversation_id = "conversations"."id")`))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    role: r.buyerId === userId ? "buyer" : "seller",
    otherName: r.otherName,
    listingId: r.listingId,
    listingTitle: r.listingTitle,
    listingPrice: r.listingPrice,
    listingStatus: r.listingStatus,
    coverKey: r.coverKey,
    lastMessageAt: r.lastMessageAt,
    lastBody: r.last?.body ?? null,
    lastKind: r.last?.kind ?? null,
    lastOffer: r.last?.offer ?? null,
    lastFromMe: r.last?.sender === userId,
    unread: r.unread,
  }));
}

/** Sohbet ve mesajları; kullanıcı taraflardan biri değilse null. */
export async function getConversation(id: string, userId: string, locale?: Locale) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const buyer = aliasedTable(users, "buyer");
  const seller = aliasedTable(users, "seller");
  const [row] = await db()
    .select({
      conversation: conversations,
      listing: {
        id: listings.id,
        title: locale ? titleIn(locale) : listings.title,
        priceEuro: listings.priceEuro,
        status: listings.status,
      },
      coverKey: sql<string | null>`(select lp.url from listing_photos lp where lp.listing_id = "listings"."id" order by lp.position limit 1)`,
      buyer: { id: buyer.id, name: buyer.name },
      seller: { id: seller.id, name: seller.name },
    })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .innerJoin(buyer, eq(buyer.id, conversations.buyerId))
    .innerJoin(seller, eq(seller.id, conversations.sellerId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row) return null;
  const { conversation } = row;
  if (conversation.buyerId !== userId && conversation.sellerId !== userId) return null;

  const items = await db()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(500);

  const role: "buyer" | "seller" = conversation.buyerId === userId ? "buyer" : "seller";
  return {
    ...row,
    role,
    other: role === "buyer" ? row.seller : row.buyer,
    messages: items,
  };
}

async function assertParticipant(conversationId: string, userId: string) {
  const [c] = await db()
    .select({ buyerId: conversations.buyerId, sellerId: conversations.sellerId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!c || (c.buyerId !== userId && c.sellerId !== userId)) return null;
  return c;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: { kind: "text"; body: string } | { kind: "offer"; amount: number },
) {
  if (!(await assertParticipant(conversationId, senderId))) return false;
  const now = new Date();
  await db().transaction(async (tx) => {
    if (input.kind === "offer") {
      // Yeni teklif gelince aynı sohbetteki bekleyen eski teklifler geçersiz olur.
      await tx
        .update(messages)
        .set({ offerStatus: "declined" })
        .where(and(eq(messages.conversationId, conversationId), eq(messages.offerStatus, "pending")));
    }
    await tx.insert(messages).values({
      conversationId,
      senderId,
      kind: input.kind,
      body: input.kind === "text" ? input.body : "",
      offerEuro: input.kind === "offer" ? input.amount : null,
      offerStatus: input.kind === "offer" ? "pending" : null,
      createdAt: now,
    });
    await tx.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
  });
  return true;
}

/** Teklife yalnızca teklifi alan taraf yanıt verebilir. */
export async function respondToOffer(messageId: string, userId: string, accept: boolean) {
  const [m] = await db()
    .select({
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      status: messages.offerStatus,
    })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.kind, "offer")))
    .limit(1);
  if (!m || m.status !== "pending" || m.senderId === userId) return null;
  if (!(await assertParticipant(m.conversationId, userId))) return null;
  await db()
    .update(messages)
    .set({ offerStatus: accept ? "accepted" : "declined" })
    .where(eq(messages.id, messageId));
  await db()
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, m.conversationId));
  return m.conversationId;
}

export async function markRead(conversationId: string, userId: string) {
  await db()
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    );
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db()
    .select({ n: count() })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    );
  return row?.n ?? 0;
}

/** İki taraf da en az bir mesaj yazdıysa birbirlerini puanlayabilir. */
export function bothParticipated(msgs: { senderId: string }[], a: string, b: string): boolean {
  return msgs.some((m) => m.senderId === a) && msgs.some((m) => m.senderId === b);
}
