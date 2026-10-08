import { type Db, getDb, schema } from "@ormaro/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const { reports, listings, users } = schema;

export const reportReasons = [
  "scam",
  "misleading",
  "prohibited",
  "inappropriate",
  "wrong_category",
  "other",
] as const;
export type ReportReason = (typeof reportReasons)[number];

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

export async function createReport(input: {
  reporterId: string;
  target: { type: "listing"; listingId: string } | { type: "user"; userId: string };
  reason: ReportReason;
  details: string;
}) {
  await db()
    .insert(reports)
    .values({
      reporterId: input.reporterId,
      targetType: input.target.type,
      listingId: input.target.type === "listing" ? input.target.listingId : null,
      userId: input.target.type === "user" ? input.target.userId : null,
      reason: input.reason,
      details: input.details,
    });
}

export async function reportQueue(status: "open" | "closed") {
  const reporter = alias(users, "reporter");
  const target = alias(users, "target");
  const owner = alias(users, "owner");
  return db()
    .select({
      id: reports.id,
      createdAt: reports.createdAt,
      targetType: reports.targetType,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      reporterName: reporter.name,
      reporterEmail: reporter.email,
      listingId: listings.id,
      listingTitle: listings.title,
      listingStatus: listings.status,
      listingOwnerId: owner.id,
      listingOwnerName: owner.name,
      userId: target.id,
      userName: target.name,
      userEmail: target.email,
      userBannedAt: target.bannedAt,
    })
    .from(reports)
    .innerJoin(reporter, eq(reporter.id, reports.reporterId))
    .leftJoin(listings, eq(listings.id, reports.listingId))
    .leftJoin(owner, eq(owner.id, listings.sellerId))
    .leftJoin(target, eq(target.id, reports.userId))
    .where(status === "open" ? inArray(reports.status, ["open", "reviewing"]) : eq(reports.status, "closed"))
    .orderBy(desc(reports.createdAt))
    .limit(100);
}

export async function closeReport(id: string, adminId: string) {
  await db()
    .update(reports)
    .set({ status: "closed", resolvedBy: adminId })
    .where(eq(reports.id, id));
}

export async function removeListingAsAdmin(listingId: string) {
  await db().update(listings).set({ status: "removed", updatedAt: new Date() }).where(eq(listings.id, listingId));
}

/** Kullanıcıyı engeller ve tüm aktif ilanlarını yayından kaldırır. */
export async function banUser(userId: string) {
  await db().transaction(async (tx) => {
    await tx.update(users).set({ bannedAt: new Date() }).where(eq(users.id, userId));
    await tx
      .update(listings)
      .set({ status: "removed", updatedAt: new Date() })
      .where(and(eq(listings.sellerId, userId), eq(listings.status, "active")));
  });
}

export async function unbanUser(userId: string) {
  await db().update(users).set({ bannedAt: null }).where(eq(users.id, userId));
}
