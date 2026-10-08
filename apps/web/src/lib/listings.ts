import { type Db, getDb, schema } from "@ormaro/db";
import type { CategoryKey, Condition } from "@ormaro/shared";
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

const { listings, listingPhotos, favorites, users } = schema;

export type ListingCard = {
  id: string;
  title: string;
  priceEuro: number;
  cityKey: string;
  condition: Condition;
  status: "active" | "sold" | "removed";
  createdAt: Date;
  coverKey: string | null;
};

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

// Alt sorguda sütun adları açıkça tabloyla yazılıyor; aksi halde "id" iç tabloya bağlanıyor.
const coverKey = sql<string | null>`(
  select lp.url from listing_photos lp
  where lp.listing_id = "listings"."id"
  order by lp.position limit 1
)`;

const cardColumns = {
  id: listings.id,
  title: listings.title,
  priceEuro: listings.priceEuro,
  cityKey: listings.cityKey,
  condition: listings.condition,
  status: listings.status,
  createdAt: listings.createdAt,
  coverKey,
};

export async function latestListings(limit = 20): Promise<ListingCard[]> {
  return db()
    .select(cardColumns)
    .from(listings)
    .where(eq(listings.status, "active"))
    .orderBy(desc(listings.createdAt))
    .limit(limit);
}

export type SearchFilters = {
  q?: string;
  category?: CategoryKey;
  city?: string;
  min?: number;
  max?: number;
  condition?: Condition;
  sort?: "new" | "price_asc" | "price_desc";
};

/**
 * Kelimelerin başıyla eşleşen arama: "masa" yazınca "masası" da bulunur.
 * Diller karışık olduğu için kök bulma yok, 'simple' sözlük kullanılıyor.
 */
export function toPrefixQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (words.length === 0) return null;
  return words.map((w) => `${w}:*`).join(" & ");
}

export async function searchListings(f: SearchFilters, limit = 50): Promise<ListingCard[]> {
  const where: SQL[] = [eq(listings.status, "active")];
  const tsquery = f.q ? toPrefixQuery(f.q) : null;
  if (tsquery) {
    where.push(
      sql`to_tsvector('simple', ${listings.title} || ' ' || ${listings.description}) @@ to_tsquery('simple', ${tsquery})`,
    );
  }
  if (f.category) where.push(eq(listings.categoryKey, f.category));
  if (f.city) where.push(eq(listings.cityKey, f.city));
  if (f.condition) where.push(eq(listings.condition, f.condition));
  if (f.min !== undefined) where.push(gte(listings.priceEuro, f.min));
  if (f.max !== undefined) where.push(lte(listings.priceEuro, f.max));

  const order =
    f.sort === "price_asc"
      ? [asc(listings.priceEuro), desc(listings.createdAt)]
      : f.sort === "price_desc"
        ? [desc(listings.priceEuro), desc(listings.createdAt)]
        : [desc(listings.createdAt)];

  return db()
    .select(cardColumns)
    .from(listings)
    .where(and(...where))
    .orderBy(...order)
    .limit(limit);
}

export async function getListing(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db()
    .select({
      listing: listings,
      seller: { id: users.id, name: users.name, createdAt: users.createdAt },
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.sellerId))
    .where(eq(listings.id, id))
    .limit(1);
  if (!row) return null;
  const photos = await db()
    .select({ key: listingPhotos.url })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, id))
    .orderBy(asc(listingPhotos.position));
  return { ...row, photos: photos.map((p) => p.key) };
}

export async function createListing(input: {
  sellerId: string;
  title: string;
  description: string;
  priceEuro: number;
  categoryKey: string;
  cityKey: string;
  condition: Condition;
  language: "me" | "en" | "tr" | "ru";
  photoKeys: string[];
}): Promise<string> {
  return db().transaction(async (tx) => {
    const [row] = await tx
      .insert(listings)
      .values({
        sellerId: input.sellerId,
        title: input.title,
        description: input.description,
        priceEuro: input.priceEuro,
        categoryKey: input.categoryKey,
        cityKey: input.cityKey,
        condition: input.condition,
        language: input.language,
      })
      .returning({ id: listings.id });
    if (!row) throw new Error("İlan kaydedilemedi.");
    if (input.photoKeys.length > 0) {
      await tx
        .insert(listingPhotos)
        .values(input.photoKeys.map((url, position) => ({ listingId: row.id, url, position })));
    }
    return row.id;
  });
}

export async function setListingStatus(
  id: string,
  sellerId: string,
  status: "active" | "sold" | "removed",
) {
  await db()
    .update(listings)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(listings.id, id), eq(listings.sellerId, sellerId)));
}

export async function listingsBySeller(sellerId: string, includeHidden: boolean) {
  return db()
    .select(cardColumns)
    .from(listings)
    .where(
      includeHidden
        ? eq(listings.sellerId, sellerId)
        : and(eq(listings.sellerId, sellerId), eq(listings.status, "active")),
    )
    .orderBy(desc(listings.createdAt));
}

export async function isFavorite(userId: string, listingId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: favorites.listingId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)))
    .limit(1);
  return rows.length > 0;
}

export async function toggleFavorite(userId: string, listingId: string) {
  const d = db();
  const deleted = await d
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)))
    .returning({ id: favorites.listingId });
  if (deleted.length === 0) {
    await d.insert(favorites).values({ userId, listingId }).onConflictDoNothing();
  }
}

export async function favoriteListings(userId: string): Promise<ListingCard[]> {
  const ids = await db()
    .select({ id: favorites.listingId })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  if (ids.length === 0) return [];
  const rows = await db()
    .select(cardColumns)
    .from(listings)
    .where(and(inArray(listings.id, ids.map((r) => r.id)), sql`${listings.status} <> 'removed'`));
  const order = new Map(ids.map((r, i) => [r.id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getUser(id: string) {
  const [row] = await db().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}
