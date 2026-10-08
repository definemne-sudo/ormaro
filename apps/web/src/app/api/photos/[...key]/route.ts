import { isValidPhotoKey, photoResponse } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const joined = key.join("/");
  if (!isValidPhotoKey(joined)) {
    return new Response("Not found", { status: 404 });
  }
  return photoResponse(joined);
}
