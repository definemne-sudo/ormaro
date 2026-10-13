"use server";

import { type Condition, listingInput, type Locale, MAX_PHOTOS_PER_LISTING, type ShippingOption } from "@ormaro/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createListing, updateListing } from "@/lib/listings";
import { getActiveUser } from "@/lib/session";
import { isValidPhotoKey } from "@/lib/storage";
import { translateToAll } from "@/lib/translate";

export type SellState = { error?: string; fields?: Record<string, string> };

type Parsed = {
  data: {
    title: string;
    description: string;
    priceEuro: number;
    categoryKey: string;
    condition: Condition;
    cityKey: string;
    language: Locale;
    shipping: ShippingOption;
  };
  photoKeys: string[];
};

/** İlan formunu doğrular; hem yeni ilan hem düzenleme için kullanılır. */
function parseListingForm(formData: FormData, userId: string): Parsed | SellState {
  const fields = Object.fromEntries(
    ["title", "description", "price", "categoryKey", "condition", "cityKey", "language", "shipping"].map((k) => [
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
  const ownPrefix = `listings/${userId}/`;
  if (photoKeys.some((k) => !isValidPhotoKey(k) || !k.startsWith(ownPrefix))) {
    return { error: "generic", fields };
  }
  photoKeys = [...new Set(photoKeys)];
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
    shipping: fields.shipping || "none",
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
  return { data: parsed.data, photoKeys };
}

export async function createListingAction(_prev: SellState, formData: FormData): Promise<SellState> {
  const locale = String(formData.get("locale") ?? "me");
  const user = await getActiveUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/sell`)}`);
  const parsed = parseListingForm(formData, user.id);
  if (!("data" in parsed)) return parsed;

  const id = await createListing({ sellerId: user.id, ...parsed.data, photoKeys: parsed.photoKeys });
  // Diğer dillere çeviri yanıt gönderildikten sonra yapılır; satıcı beklemez.
  after(() =>
    translateToAll({ id, title: parsed.data.title, description: parsed.data.description, language: parsed.data.language }),
  );
  redirect(`/${locale}/listing/${id}`);
}

export async function updateListingAction(_prev: SellState, formData: FormData): Promise<SellState> {
  const locale = String(formData.get("locale") ?? "me");
  const id = String(formData.get("listingId") ?? "");
  const user = await getActiveUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/listing/${id}/edit`)}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "generic" };
  const parsed = parseListingForm(formData, user.id);
  if (!("data" in parsed)) return parsed;

  const result = await updateListing(id, user.id, { ...parsed.data, photoKeys: parsed.photoKeys });
  if (!result) return { error: "generic" };
  // Metin değiştiyse eski çeviriler silindi; yenileri arka planda üretilir.
  if (result.textChanged) {
    after(() =>
      translateToAll({ id, title: parsed.data.title, description: parsed.data.description, language: parsed.data.language }),
    );
  }
  revalidatePath(`/${locale}/listing/${id}`);
  revalidatePath(`/${locale}/profile`);
  redirect(`/${locale}/listing/${id}`);
}
