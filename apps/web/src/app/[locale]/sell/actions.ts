"use server";

import { listingInput, MAX_PHOTOS_PER_LISTING } from "@ormaro/shared";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createListing } from "@/lib/listings";
import { getActiveUser } from "@/lib/session";
import { isValidPhotoKey } from "@/lib/storage";
import { translateToAll } from "@/lib/translate";

export type SellState = { error?: string; fields?: Record<string, string> };

export async function createListingAction(_prev: SellState, formData: FormData): Promise<SellState> {
  const locale = String(formData.get("locale") ?? "me");
  const user = await getActiveUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/sell`)}`);

  const fields = Object.fromEntries(
    ["title", "description", "price", "categoryKey", "condition", "cityKey", "language"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  ) as Record<string, string>;

  let photoKeys: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(formData.get("photos") ?? "[]"));
    if (Array.isArray(parsed)) photoKeys = parsed.filter((k): k is string => typeof k === "string");
  } catch {
    return { error: "generic", fields };
  }
  // Yalnızca bu kullanıcının yüklediği fotoğraflar kabul edilir.
  const ownPrefix = `listings/${user.id}/`;
  if (photoKeys.some((k) => !isValidPhotoKey(k) || !k.startsWith(ownPrefix))) {
    return { error: "generic", fields };
  }
  if (photoKeys.length === 0) return { error: "photosRequired", fields };
  if (photoKeys.length > MAX_PHOTOS_PER_LISTING) return { error: "tooManyPhotos", fields };

  const price = Number(fields.price?.replace(/[^\d]/g, ""));
  const parsed = listingInput.safeParse({
    title: fields.title,
    description: fields.description,
    priceEuro: Number.isFinite(price) && fields.price !== "" ? price : Number.NaN,
    categoryKey: fields.categoryKey,
    condition: fields.condition,
    cityKey: fields.cityKey,
    language: fields.language,
  });
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    const error =
      path === "title"
        ? "titleInvalid"
        : path === "priceEuro"
          ? "priceInvalid"
          : path === "cityKey"
            ? "cityRequired"
            : path === "categoryKey"
              ? "categoryRequired"
              : path === "condition"
                ? "conditionRequired"
                : "generic";
    return { error, fields };
  }

  const id = await createListing({ sellerId: user.id, ...parsed.data, photoKeys });
  // Diğer dillere çeviri yanıt gönderildikten sonra yapılır; satıcı beklemez.
  after(() =>
    translateToAll({
      id,
      title: parsed.data.title,
      description: parsed.data.description,
      language: parsed.data.language,
    }),
  );
  redirect(`/${locale}/listing/${id}`);
}
