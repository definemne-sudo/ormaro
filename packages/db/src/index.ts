import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };

/**
 * DATABASE_URL değerini temizler ve denetler. Hata mesajları şifreyi göstermez.
 */
export function parseDatabaseUrl(raw: string): string {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  if (value.includes("${{")) {
    throw new Error(
      "DATABASE_URL bir Railway referansı içeriyor (${{...}}). Vercel bunu çözemez; Railway'deki gerçek değeri kopyalayın.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `DATABASE_URL geçerli bir adres değil. "postgresql://kullanici:sifre@host:port/veritabani" biçiminde olmalı. ` +
        `Şu anki değer ${value.length} karakter; ` +
        `"postgres" ile ${value.startsWith("postgres") ? "başlıyor" : "başlamıyor"}; ` +
        `${/\s/.test(value) ? "içinde boşluk veya satır sonu var" : "boşluk yok"}; ` +
        `"@" işareti ${value.includes("@") ? "var" : "yok"}.`,
    );
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error(`DATABASE_URL "postgresql://" ile başlamalı, "${parsed.protocol}//" ile başlıyor.`);
  }
  if (parsed.hostname.endsWith(".railway.internal")) {
    throw new Error(
      "DATABASE_URL Railway'in iç adresini gösteriyor. Vercel'den erişilemez; DATABASE_PUBLIC_URL değerini kullanın.",
    );
  }
  return value;
}

/**
 * Veritabanı bağlantısı oluşturur. Vercel'in sunucusuz fonksiyonlarında
 * bağlantı sayısını düşük tutmak için havuz küçük.
 */
export function createDb(url: string) {
  const client = postgres(parseDatabaseUrl(url), { max: 1, prepare: false });
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
