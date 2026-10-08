import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { isStorageConfigured, putPhoto } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, "webp" | "jpg"> = { "image/webp": "webp", "image/jpeg": "jpg" };

/**
 * İlan fotoğrafı yükleme. Fotoğraf telefonda küçültülüp buraya gelir,
 * sunucu depoya yazar ve nesne anahtarını döner. İlan kaydedilince anahtar ilana bağlanır.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return Response.json({ error: "storage_not_configured" }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  const ext = TYPES[file.type];
  if (!ext) {
    return Response.json({ error: "bad_type" }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const key = `listings/${session.user.id}/${randomUUID()}.${ext}`;
  await putPhoto(key, new Uint8Array(await file.arrayBuffer()), file.type);
  return Response.json({ key });
}
