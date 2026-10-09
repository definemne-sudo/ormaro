import { type Db, getDb, schema } from "@ormaro/db";
import { locales, type Locale } from "@ormaro/shared";
import { and, eq, isNull, ne, sql } from "drizzle-orm";

const { listings, listingTranslations } = schema;

/**
 * İlanlar Google Cloud Translation (Basic v2) ile alıcının diline çevrilir.
 * Ücretsiz kotası ayda 500.000 karakter. Anahtar yoksa ilanlar yazıldıkları dilde görünür.
 */
export const translationEnabled = Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);

/**
 * Google'da ayrı bir Karadağca yok. Boşnakça hem Latin alfabeli hem de Karadağca gibi
 * "ijekavian" olduğu için en yakın sonucu veriyor (mlijeko, vrijeme).
 */
const googleCode: Record<Locale, string> = { me: "bs", en: "en", tr: "tr", ru: "ru" };

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function googleTranslate(texts: string[], from: Locale, to: Locale): Promise<string[]> {
  const res = await fetch(
    `${process.env.GOOGLE_TRANSLATE_ENDPOINT || "https://translation.googleapis.com/language/translate/v2"}?key=${encodeURIComponent(process.env.GOOGLE_TRANSLATE_API_KEY ?? "")}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: texts, source: googleCode[from], target: googleCode[to], format: "text" }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) throw new Error(`Çeviri hatası ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { data?: { translations?: { translatedText: string }[] } };
  const out = json.data?.translations?.map((t) => decodeEntities(t.translatedText)) ?? [];
  if (out.length !== texts.length) throw new Error("Çeviri yanıtı eksik.");
  return out;
}

export type ListingText = { id: string; title: string; description: string; language: Locale };

/** İlanın bir dile çevirisini oluşturur (yoksa). Hata olursa sessizce asıl metin kalır. */
export async function ensureTranslation(listing: ListingText, to: Locale) {
  if (!translationEnabled || listing.language === to) return null;
  const [existing] = await db()
    .select()
    .from(listingTranslations)
    .where(and(eq(listingTranslations.listingId, listing.id), eq(listingTranslations.locale, to)))
    .limit(1);
  if (existing) return existing;
  try {
    const texts = listing.description ? [listing.title, listing.description] : [listing.title];
    const [title = listing.title, description = ""] = await googleTranslate(texts, listing.language, to);
    const [row] = await db()
      .insert(listingTranslations)
      .values({ listingId: listing.id, locale: to, title: title.slice(0, 200), description })
      .onConflictDoNothing()
      .returning();
    return row ?? null;
  } catch (e) {
    console.error("İlan çevrilemedi", listing.id, to, e);
    return null;
  }
}

export async function existingTranslation(listingId: string, locale: Locale) {
  const [row] = await db()
    .select()
    .from(listingTranslations)
    .where(and(eq(listingTranslations.listingId, listingId), eq(listingTranslations.locale, locale)))
    .limit(1);
  return row ?? null;
}

/** Yeni ilanı diğer üç dile çevirir; aramada da bu çeviriler kullanılır. */
export async function translateToAll(listing: ListingText) {
  if (!translationEnabled) return;
  await Promise.all(locales.filter((l) => l !== listing.language).map((l) => ensureTranslation(listing, l)));
}

/** Bu dilde çevirisi eksik olan birkaç aktif ilanı tamamlar (eski ilanlar için). */
export async function translateMissing(to: Locale, limit = 10) {
  if (!translationEnabled) return;
  const rows = await db()
    .select({
      id: listings.id,
      title: listings.title,
      description: listings.description,
      language: listings.language,
    })
    .from(listings)
    .leftJoin(
      listingTranslations,
      and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, to)),
    )
    .where(and(eq(listings.status, "active"), ne(listings.language, to), isNull(listingTranslations.listingId)))
    .orderBy(sql`${listings.createdAt} desc`)
    .limit(limit);
  for (const r of rows) await ensureTranslation(r, to);
}
