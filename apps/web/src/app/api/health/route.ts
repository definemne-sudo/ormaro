import { getDb } from "@ormaro/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Canlıda veritabanı bağlantısını kontrol etmek için: /api/health */
export async function GET() {
  const db = getDb();
  if (!db) {
    return Response.json({ ok: true, db: "not_configured" });
  }
  try {
    const rows = await db.execute<{ cities: number }>(
      sql`select count(*)::int as cities from cities`,
    );
    return Response.json({ ok: true, db: "ok", cities: rows[0]?.cities ?? 0 });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false, db: "error" }, { status: 503 });
  }
}
