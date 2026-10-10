"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getOrCreateConversation,
  MAX_MESSAGE_LENGTH,
  respondToOffer,
  sendMessage,
} from "@/lib/messages";
import { after } from "next/server";
import { notifyUser } from "@/lib/push";
import { getActiveUser } from "@/lib/session";

export async function startConversationAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  const listingId = String(formData.get("listingId") ?? "");
  const user = await getActiveUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/listing/${listingId}`)}`);
  }
  if (!/^[0-9a-f-]{36}$/.test(listingId)) redirect(`/${locale}`);
  const result = await getOrCreateConversation(listingId, user.id);
  if ("error" in result) redirect(`/${locale}/listing/${listingId}`);
  redirect(`/${locale}/messages/${result.id}`);
}

export type ComposerState = { error?: string; sent?: number };

export async function sendMessageAction(prev: ComposerState, formData: FormData): Promise<ComposerState> {
  const user = await getActiveUser();
  if (!user) return { error: "generic" };
  const locale = String(formData.get("locale") ?? "me");
  const conversationId = String(formData.get("conversationId") ?? "");
  const mode = String(formData.get("mode") ?? "text");

  let ok: { recipientId: string } | null = null;
  let amount = 0;
  let body = "";
  if (mode === "offer") {
    amount = Number(String(formData.get("amount") ?? "").replace(/[^\d]/g, ""));
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) return { error: "invalidOffer" };
    ok = await sendMessage(conversationId, user.id, { kind: "offer", amount });
  } else {
    body = String(formData.get("body") ?? "").trim();
    if (!body) return { error: "empty" };
    if (body.length > MAX_MESSAGE_LENGTH) return { error: "tooLong" };
    ok = await sendMessage(conversationId, user.id, { kind: "text", body });
  }
  if (!ok) return { error: "generic" };
  const recipientId = ok.recipientId;
  const from = user.name ?? "Ormaro";
  after(() =>
    notifyUser(
      recipientId,
      mode === "offer"
        ? { kind: "offer", from, amount }
        : { kind: "message", from, text: body },
      conversationId,
    ),
  );
  revalidatePath(`/${locale}/messages/${conversationId}`);
  return { sent: (prev.sent ?? 0) + 1 };
}

export async function respondOfferAction(formData: FormData) {
  const user = await getActiveUser();
  if (!user) return;
  const locale = String(formData.get("locale") ?? "me");
  const messageId = String(formData.get("messageId") ?? "");
  const accept = formData.get("accept") === "1";
  if (!/^[0-9a-f-]{36}$/.test(messageId)) return;
  const result = await respondToOffer(messageId, user.id, accept);
  if (!result) return;
  const from = user.name ?? "Ormaro";
  after(() =>
    notifyUser(
      result.offerSenderId,
      { kind: accept ? "offerAccepted" : "offerDeclined", from, amount: result.amount },
      result.conversationId,
    ),
  );
  revalidatePath(`/${locale}/messages/${result.conversationId}`);
}
