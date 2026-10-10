import { createECDH, hkdfSync } from "node:crypto";
import { type Db, getDb, schema } from "@ormaro/db";
import type { Locale } from "@ormaro/shared";
import { eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import webpush from "web-push";
import { formatPrice } from "./format";

const { pushSubscriptions } = schema;

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

type Vapid = { publicKey: string; privateKey: string };
let cached: Vapid | null | undefined;

/**
 * Bildirim anahtarları. VAPID_PUBLIC_KEY ve VAPID_PRIVATE_KEY verilmemişse
 * AUTH_SECRET'tan her seferinde aynı çıkacak şekilde türetilir; ayrıca ayar gerekmez.
 * AUTH_SECRET değişirse eski abonelikler geçersiz olur, tarayıcı yeniden abone olur.
 */
export function vapidKeys(): Vapid | null {
  if (cached !== undefined) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret) return (cached = null);
  for (let i = 0; i < 10; i++) {
    const priv = Buffer.from(hkdfSync("sha256", secret, "ormaro", `vapid-p256-${i}`, 32));
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(priv);
      cached = {
        publicKey: ecdh.getPublicKey().toString("base64url"),
        privateKey: priv.toString("base64url"),
      };
      return cached;
    } catch {
      // Çok düşük olasılıkla geçersiz anahtar çıkar; bir sonrakini dene.
    }
  }
  return (cached = null);
}

export function pushEnabled(): boolean {
  return vapidKeys() !== null;
}

export async function saveSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: Locale;
}) {
  await db()
    .insert(pushSubscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: input.userId, p256dh: input.p256dh, auth: input.auth, locale: input.locale },
    });
}

export async function deleteSubscription(userId: string, endpoint: string) {
  const rows = await db()
    .select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  const own = rows.filter((r) => r.userId === userId).map((r) => r.id);
  if (own.length > 0) await db().delete(pushSubscriptions).where(inArray(pushSubscriptions.id, own));
}

export type PushEvent =
  | { kind: "message"; from: string; text: string }
  | { kind: "offer"; from: string; amount: number }
  | { kind: "offerAccepted"; from: string; amount: number }
  | { kind: "offerDeclined"; from: string; amount: number };

/** Kullanıcının bütün cihazlarına bildirim gönderir. Hata olursa sessizce geçer. */
export async function notifyUser(userId: string, event: PushEvent, conversationId: string) {
  const keys = vapidKeys();
  if (!keys || !getDb()) return;
  try {
    const subs = await db().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (subs.length === 0) return;
    const gone: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        const t = await getTranslations({ locale: s.locale, namespace: "push" });
        const body =
          event.kind === "message"
            ? event.text.length > 140
              ? `${event.text.slice(0, 137)}…`
              : event.text
            : t(event.kind, { amount: formatPrice(event.amount, s.locale) });
        const payload = JSON.stringify({
          title: event.from,
          body,
          url: `/${s.locale}/messages/${conversationId}`,
          tag: `conv-${conversationId}`,
        });
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            vapidDetails: {
              subject: process.env.VAPID_SUBJECT || "https://ormaro.vercel.app",
              publicKey: keys.publicKey,
              privateKey: keys.privateKey,
            },
            TTL: 60 * 60 * 24,
            urgency: "high",
          });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // Tarayıcı aboneliği iptal ettiyse kaydı sil.
          if (status === 404 || status === 410 || status === 403) gone.push(s.id);
          else console.error("Bildirim gönderilemedi", status, e);
        }
      }),
    );
    if (gone.length > 0) await db().delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  } catch (e) {
    console.error("Bildirim hatası", e);
  }
}
