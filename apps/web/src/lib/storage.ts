import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { devLoginEnabled } from "@/auth";

/**
 * Fotoğraf deposu. Canlıda Railway'in S3 uyumlu deposu kullanılır.
 * Yalnızca yerel denemede (ALLOW_DEV_LOGIN=1 ve depo ayarsız) dosyalar diske yazılır.
 */

const PHOTO_KEY = /^listings\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/;

export function isValidPhotoKey(key: string): boolean {
  return PHOTO_KEY.test(key);
}

type Driver =
  | { kind: "s3"; client: S3Client; bucket: string }
  | { kind: "local"; dir: string }
  | { kind: "none" };

let cached: Driver | undefined;

function driver(): Driver {
  if (cached) return cached;
  const { BUCKET_ENDPOINT, BUCKET_ACCESS_KEY_ID, BUCKET_SECRET_ACCESS_KEY, BUCKET_NAME } =
    process.env;
  if (BUCKET_ENDPOINT && BUCKET_ACCESS_KEY_ID && BUCKET_SECRET_ACCESS_KEY && BUCKET_NAME) {
    cached = {
      kind: "s3",
      bucket: BUCKET_NAME,
      client: new S3Client({
        endpoint: BUCKET_ENDPOINT,
        region: process.env.BUCKET_REGION || "auto",
        forcePathStyle: process.env.BUCKET_PATH_STYLE === "1",
        credentials: {
          accessKeyId: BUCKET_ACCESS_KEY_ID,
          secretAccessKey: BUCKET_SECRET_ACCESS_KEY,
        },
      }),
    };
  } else if (devLoginEnabled) {
    cached = { kind: "local", dir: path.join(/* turbopackIgnore: true */ process.cwd(), ".uploads") };
  } else {
    cached = { kind: "none" };
  }
  return cached;
}

export function isStorageConfigured(): boolean {
  return driver().kind !== "none";
}

export async function putPhoto(key: string, body: Uint8Array, contentType: string) {
  const d = driver();
  if (d.kind === "s3") {
    await d.client.send(
      new PutObjectCommand({
        Bucket: d.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } else if (d.kind === "local") {
    const file = path.join(/* turbopackIgnore: true */ d.dir, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  } else {
    throw new Error("Fotoğraf deposu ayarlı değil.");
  }
}

/** Tarayıcıya dönecek yanıt: S3'te kısa süreli imzalı adrese yönlendirme, yerelde dosyanın kendisi. */
export async function photoResponse(key: string): Promise<Response> {
  const d = driver();
  if (d.kind === "s3") {
    const url = await getSignedUrl(
      d.client,
      new GetObjectCommand({ Bucket: d.bucket, Key: key }),
      { expiresIn: 3600 },
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        // İmzalı adres 60 dakika geçerli; Vercel'in önbelleği yönlendirmeyi 50 dakika tutar.
        "Cache-Control": "public, max-age=3000, s-maxage=3000",
      },
    });
  }
  if (d.kind === "local") {
    try {
      const data = await readFile(path.join(/* turbopackIgnore: true */ d.dir, key));
      return new Response(data, {
        headers: { "Content-Type": key.endsWith(".jpg") ? "image/jpeg" : "image/webp" },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  return new Response("Storage not configured", { status: 503 });
}

export function photoSrc(key: string): string {
  return `/api/photos/${key}`;
}
