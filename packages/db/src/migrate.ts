import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { parseDatabaseUrl } from "./index";

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

let cleanUrl: string;
try {
  cleanUrl = parseDatabaseUrl(url);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const client = postgres(cleanUrl, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await client.end();
console.log("Göçler uygulandı.");
