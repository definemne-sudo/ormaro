import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { type Db, getDb, schema } from "@ormaro/db";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";

const { emailCodes, users } = schema;

const CODE_TTL_MS = 15 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_PER_HOUR = 5;

export type Purpose = "register" | "reset";

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function digest(value: string, email: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "ormaro").update(`${email}:${value}`).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function findUserByEmail(email: string) {
  const [row] = await db().select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

/**
 * Yeni kod üretir. Aynı adrese dakikada bir, saatte en çok beş kod gider.
 * Dönen kod e-postayla gönderilir, veritabanında yalnızca özeti tutulur.
 */
export async function issueCode(input: {
  email: string;
  purpose: Purpose;
  name?: string;
  passwordHash?: string;
}): Promise<{ code: string } | { error: "tooSoon" | "tooMany" }> {
  const d = db();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [stats] = await d
    .select({ n: count() })
    .from(emailCodes)
    .where(and(eq(emailCodes.email, input.email), gt(emailCodes.createdAt, hourAgo)));
  if ((stats?.n ?? 0) >= MAX_PER_HOUR) return { error: "tooMany" };
  const [last] = await d
    .select({ createdAt: emailCodes.createdAt })
    .from(emailCodes)
    .where(eq(emailCodes.email, input.email))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (last && Date.now() - last.createdAt.getTime() < RESEND_AFTER_MS) return { error: "tooSoon" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Aynı amaçla verilmiş eski kodlar geçersiz olur.
  await d
    .update(emailCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(emailCodes.email, input.email), eq(emailCodes.purpose, input.purpose), isNull(emailCodes.consumedAt)));
  await d.insert(emailCodes).values({
    email: input.email,
    purpose: input.purpose,
    codeHash: digest(code, input.email),
    name: input.name ?? null,
    passwordHash: input.passwordHash ?? null,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return { code };
}

/**
 * Kodu doğrular. Doğruysa kayıt ya da şifre değişikliği uygulanır ve
 * oturumu açmak için tek kullanımlık bir bilet döner.
 */
export async function redeemCode(input: {
  email: string;
  purpose: Purpose;
  code: string;
  newPasswordHash?: string;
}): Promise<{ ticket: string } | { error: "invalid" | "expired" | "tooManyAttempts" }> {
  const d = db();
  const [row] = await d
    .select()
    .from(emailCodes)
    .where(and(eq(emailCodes.email, input.email), eq(emailCodes.purpose, input.purpose), isNull(emailCodes.consumedAt)))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (!row) return { error: "expired" };
  if (row.expiresAt.getTime() < Date.now()) return { error: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { error: "tooManyAttempts" };
  if (!same(digest(input.code.replace(/\D/g, ""), input.email), row.codeHash)) {
    await d.update(emailCodes).set({ attempts: row.attempts + 1 }).where(eq(emailCodes.id, row.id));
    return { error: row.attempts + 1 >= MAX_ATTEMPTS ? "tooManyAttempts" : "invalid" };
  }

  const passwordHash = input.purpose === "register" ? row.passwordHash : input.newPasswordHash;
  if (!passwordHash) return { error: "invalid" };
  const now = new Date();
  if (input.purpose === "register") {
    await d
      .insert(users)
      .values({ email: input.email, name: row.name, passwordHash, emailVerifiedAt: now })
      .onConflictDoUpdate({
        target: users.email,
        // Kod e-postanın sahibine gittiği için mevcut hesaba şifre bağlamak güvenli.
        set: { passwordHash, emailVerifiedAt: now },
      });
  } else {
    const updated = await d
      .update(users)
      .set({ passwordHash, emailVerifiedAt: now })
      .where(eq(users.email, input.email))
      .returning({ id: users.id });
    if (updated.length === 0) return { error: "invalid" };
  }

  const ticket = randomBytes(32).toString("base64url");
  await d
    .update(emailCodes)
    .set({
      consumedAt: now,
      ticketHash: digest(ticket, input.email),
      ticketExpiresAt: new Date(Date.now() + TICKET_TTL_MS),
    })
    .where(eq(emailCodes.id, row.id));
  return { ticket };
}

/** Bileti bir kez kullanır; geçerliyse kullanıcıyı döner. */
export async function consumeTicket(email: string, ticket: string) {
  const d = db();
  const hash = digest(ticket, email);
  const [row] = await d
    .update(emailCodes)
    .set({ ticketHash: null })
    .where(and(eq(emailCodes.email, email), eq(emailCodes.ticketHash, hash), gt(emailCodes.ticketExpiresAt, new Date())))
    .returning({ id: emailCodes.id });
  if (!row) return null;
  return findUserByEmail(email);
}

/** Kodu yeniden göndermek için son kaydın ad ve şifre bilgisini alır. */
export async function latestRegistration(email: string) {
  const [row] = await db()
    .select({ name: emailCodes.name, passwordHash: emailCodes.passwordHash })
    .from(emailCodes)
    .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, "register")))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  return row?.passwordHash ? { name: row.name ?? undefined, passwordHash: row.passwordHash } : null;
}
