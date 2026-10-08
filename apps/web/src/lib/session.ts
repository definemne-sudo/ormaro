import { getDb, schema } from "@ormaro/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/** Giriş yapılmamışsa giriş sayfasına yollar, dönünce aynı sayfaya gelinir. */
export async function requireUser(locale: string, returnTo: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}${returnTo}`)}`);
  }
  return user;
}

/**
 * Yazma işlemleri için: oturumu açık ve engellenmemiş kullanıcı.
 * Oturum JWT'de tutulduğu için engel durumu her işlemde veritabanından okunur.
 */
export async function getActiveUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ bannedAt: schema.users.bannedAt, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  if (!row || row.bannedAt) return null;
  return { ...user, role: row.role };
}
