"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireUser } from "@/lib/session";
import { setListingStatus, toggleFavorite } from "@/lib/listings";

export async function toggleFavoriteAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  const id = String(formData.get("id") ?? "");
  const user = await requireUser(locale, `/listing/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await toggleFavorite(user.id, id);
  revalidatePath(`/${locale}/listing/${id}`);
  revalidatePath(`/${locale}/profile`);
}

export async function setStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const locale = String(formData.get("locale") ?? "me");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  if (status !== "active" && status !== "sold" && status !== "removed") return;
  // Yalnızca ilanın sahibi değiştirebilir; sorgu sahibi de koşul olarak kullanıyor.
  await setListingStatus(id, user.id, status);
  revalidatePath(`/${locale}/listing/${id}`);
  revalidatePath(`/${locale}/profile`);
  revalidatePath(`/${locale}`);
}
