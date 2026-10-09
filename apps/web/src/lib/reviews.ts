import { type Db, getDb, schema } from "@ormaro/db";
import { and, avg, count, desc, eq } from "drizzle-orm";

import type { Locale } from "@ormaro/shared";
import { titleIn } from "./listings";

const { reviews, users, listings } = schema;

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

export async function ratingSummary(userId: string) {
  const [row] = await db()
    .select({ avg: avg(reviews.rating), n: count() })
    .from(reviews)
    .where(eq(reviews.subjectId, userId));
  const n = row?.n ?? 0;
  return { count: n, average: n > 0 ? Number(row?.avg ?? 0) : null };
}

export async function reviewsAbout(userId: string, locale: Locale, limit = 20) {
  return db()
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      authorName: users.name,
      listingTitle: titleIn(locale),
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorId))
    .leftJoin(listings, eq(listings.id, reviews.listingId))
    .where(eq(reviews.subjectId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function existingReview(authorId: string, listingId: string) {
  const [row] = await db()
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.authorId, authorId), eq(reviews.listingId, listingId)))
    .limit(1);
  return row ?? null;
}

export async function createReview(input: {
  authorId: string;
  subjectId: string;
  listingId: string;
  rating: number;
  comment: string;
}) {
  await db().insert(reviews).values(input).onConflictDoNothing();
}
