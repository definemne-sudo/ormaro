import { categoryKeys, cities as cityList } from "@ormaro/shared";
import { sql } from "drizzle-orm";
import { createDb } from "./index";
import { categories, cities } from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // Vercel'de değişken henüz eklenmemişse yayını bozma, sadece atla.
  if (process.env.VERCEL) {
    console.warn("DATABASE_URL tanımlı değil, veritabanı adımı atlandı.");
    process.exit(0);
  }
  console.error("DATABASE_URL tanımlı değil.");
  process.exit(1);
}

const db = createDb(url);

await db
  .insert(cities)
  .values(cityList.map((c) => ({ key: c.key, region: c.region })))
  .onConflictDoUpdate({ target: cities.key, set: { region: sql`excluded.region` } });

await db
  .insert(categories)
  .values(categoryKeys.map((key, i) => ({ key, sort: i })))
  .onConflictDoUpdate({ target: categories.key, set: { sort: sql`excluded.sort` } });

await db.$client.end();
console.log(`${cityList.length} şehir ve ${categoryKeys.length} kategori yüklendi.`);
