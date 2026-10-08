import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };

/**
 * Veritabanı bağlantısı oluşturur. Vercel'in sunucusuz fonksiyonlarında
 * bağlantı sayısını düşük tutmak için havuz küçük.
 */
export function createDb(url: string) {
  const client = postgres(url, { max: 1, prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;

/** DATABASE_URL tanımlı değilse undefined döner. */
export function getDb(): Db | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  cached ??= createDb(url);
  return cached;
}
