import { type Db, getDb, schema } from "@ormaro/db";
import { and, desc, eq, or } from "drizzle-orm";

const { userBlocks, users } = schema;

function db(): Db {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL tanımlı değil.");
  return d;
}

export type BlockState = "none" | "iBlocked" | "blockedMe";

/** İki kullanıcı arasındaki engel durumu (benim açımdan). */
export async function blockState(me: string, other: string): Promise<BlockState> {
  const rows = await db()
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, other)),
        and(eq(userBlocks.blockerId, other), eq(userBlocks.blockedId, me)),
      ),
    );
  if (rows.some((r) => r.blockerId === me)) return "iBlocked";
  if (rows.length > 0) return "blockedMe";
  return "none";
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  return (await blockState(a, b)) !== "none";
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) return;
  await db().insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db()
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
}

export async function blockedUsers(blockerId: string) {
  return db()
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, createdAt: userBlocks.createdAt })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, blockerId))
    .orderBy(desc(userBlocks.createdAt));
}
