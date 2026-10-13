"use server";

import { type CourierKey, courierKeys } from "@ormaro/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyUser } from "@/lib/push";
import { getActiveUser } from "@/lib/session";
import { cancelShipment, markDelivered, markShipped, requestShipment } from "@/lib/shipments";

const uuid = /^[0-9a-f-]{36}$/;

function back(locale: string, conversationId: string, params?: Record<string, string>): never {
  const q = params ? `?${new URLSearchParams(params)}` : "";
  redirect(`/${locale}/messages/${conversationId}${q}`);
}

async function requireUser(locale: string) {
  const user = await getActiveUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

export async function requestShipmentAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!uuid.test(conversationId)) redirect(`/${locale}/messages`);
  const user = await requireUser(locale);
  const input = {
    recipientName: String(formData.get("recipientName") ?? "").trim().replace(/\s+/g, " "),
    phone: String(formData.get("phone") ?? "").trim(),
    cityKey: String(formData.get("cityKey") ?? ""),
    address: String(formData.get("address") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim().slice(0, 300),
  };
  const result = await requestShipment(conversationId, user.id, input);
  if ("error" in result) {
    // Yazılanlar kaybolmasın diye adres alanları sayfaya geri taşınır.
    back(locale, conversationId, {
      ship: "1",
      shipError: result.error,
      n: input.recipientName,
      p: input.phone,
      c: input.cityKey,
      a: input.address,
      o: input.note,
    });
  }
  const from = user.name ?? "Ormaro";
  after(() => notifyUser(result.sellerId, { kind: "shipRequested", from, amount: 0 }, conversationId));
  revalidatePath(`/${locale}/messages/${conversationId}`);
  back(locale, conversationId);
}

export async function markShippedAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  const conversationId = String(formData.get("conversationId") ?? "");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  if (!uuid.test(conversationId) || !uuid.test(shipmentId)) redirect(`/${locale}/messages`);
  const user = await requireUser(locale);
  const courierKey = String(formData.get("courierKey") ?? "") as CourierKey;
  if (!courierKeys.includes(courierKey)) back(locale, conversationId, { shipError: "courier" });
  const s = await markShipped(
    shipmentId,
    user.id,
    courierKey,
    String(formData.get("courierName") ?? ""),
    String(formData.get("trackingNumber") ?? ""),
  );
  if (!s) back(locale, conversationId, { shipError: "tracking" });
  const from = user.name ?? "Ormaro";
  after(() =>
    notifyUser(
      s.buyerId,
      { kind: "shipped", from, amount: s.amountEuro, courier: s.courierName ?? "", tracking: s.trackingNumber ?? "" },
      conversationId,
    ),
  );
  revalidatePath(`/${locale}/messages/${conversationId}`);
  back(locale, conversationId);
}

export async function markDeliveredAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  const conversationId = String(formData.get("conversationId") ?? "");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  if (!uuid.test(conversationId) || !uuid.test(shipmentId)) redirect(`/${locale}/messages`);
  const user = await requireUser(locale);
  const s = await markDelivered(shipmentId, user.id);
  if (s) {
    const from = user.name ?? "Ormaro";
    after(() => notifyUser(s.sellerId, { kind: "delivered", from, amount: s.amountEuro }, conversationId));
  }
  revalidatePath(`/${locale}/messages/${conversationId}`);
  back(locale, conversationId);
}

export async function cancelShipmentAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  const conversationId = String(formData.get("conversationId") ?? "");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  if (!uuid.test(conversationId) || !uuid.test(shipmentId)) redirect(`/${locale}/messages`);
  const user = await requireUser(locale);
  const s = await cancelShipment(shipmentId, user.id);
  if (s) {
    const other = s.cancelledBy === "buyer" ? s.sellerId : s.buyerId;
    const from = user.name ?? "Ormaro";
    after(() => notifyUser(other, { kind: "shipCancelled", from, amount: s.amountEuro }, conversationId));
  }
  revalidatePath(`/${locale}/messages/${conversationId}`);
  back(locale, conversationId);
}
