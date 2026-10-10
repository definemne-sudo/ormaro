import { locales, type Locale } from "@ormaro/shared";
import { deleteSubscription, saveSubscription, vapidKeys } from "@/lib/push";
import { getActiveUser } from "@/lib/session";

export const runtime = "nodejs";

/** Tarayıcının abone olacağı açık anahtar. */
export async function GET() {
  const keys = vapidKeys();
  if (!keys) return Response.json({ error: "disabled" }, { status: 503 });
  return Response.json({ publicKey: keys.publicKey });
}

type Body = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; locale?: unknown };

function isPushEndpoint(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 1000) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!body || !isPushEndpoint(body.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const locale = (locales as readonly string[]).includes(String(body.locale)) ? (body.locale as Locale) : "me";
  await saveSubscription({ userId: user.id, endpoint: body.endpoint, p256dh, auth, locale });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getActiveUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || !isPushEndpoint(body.endpoint)) return Response.json({ error: "invalid" }, { status: 400 });
  await deleteSubscription(user.id, body.endpoint);
  return Response.json({ ok: true });
}
