/** Tarayıcıda çalışan fotoğraf küçültme ve yükleme yardımcıları. */

/** Fotoğrafı telefonda küçültür: en uzun kenar varsayılan 1600 px, WebP (desteklenmiyorsa JPEG). */
export async function compress(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp", 0.8);
  // Bazı tarayıcılar WebP üretemez ve sessizce PNG döner; o durumda JPEG'e geçilir.
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg", 0.82);
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

export async function upload(blob: Blob, kind: "listing" | "avatar" = "listing"): Promise<string> {
  const body = new FormData();
  if (kind === "avatar") body.append("kind", "avatar");
  body.append("file", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
  const res = await fetch("/api/uploads", { method: "POST", body });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  const data = (await res.json()) as { key?: string };
  if (!data.key) throw new Error("upload");
  return data.key;
}
