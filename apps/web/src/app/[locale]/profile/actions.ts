"use server";

import { cities } from "@ormaro/shared";
import { getDb, schema } from "@ormaro/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockUser, unblockUser } from "@/lib/blocks";
import { getActiveUser } from "@/lib/session";
import { isValidPhotoKey } from "@/lib/storage";

export type ProfileState = { error?: "name" | "photo" | "generic"; fields?: { name: string; cityKey: string } };

export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const locale = String(formData.get("locale") ?? "me");
  const user = await getActiveUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/profile/edit`)}`);
  const db = getDb();
  if (!db) return { error: "generic" };

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const cityKey = String(formData.get("cityKey") ?? "");
  const avatar = String(formData.get("avatar") ?? "keep");
  const fields = { name, cityKey };
  if (name.length < 2 || name.length > 60) return { error: "name", fields };
  if (cityKey && !cities.some((c) => c.key === cityKey)) return { error: "generic", fields };

  let avatarUrl: string | null | undefined;
  if (avatar === "remove") avatarUrl = null;
  else if (avatar !== "keep") {
    // Yalnızca bu kullanıcının yüklediği profil fotoğrafı kabul edilir.
    if (!isValidPhotoKey(avatar) || !avatar.startsWith(`avatars/${user.id}/`)) return { error: "photo", fields };
    avatarUrl = avatar;
  }

  await db
    .update(schema.users)
    .set({ name, cityKey: cityKey || null, ...(avatarUrl !== undefined ? { avatarUrl } : {}) })
    .where(eq(schema.users.id, user.id));
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/profile`);
}

export async function blockAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  const target = String(formData.get("userId") ?? "");
  const back = String(formData.get("back") ?? "");
  const user = await getActiveUser();
  if (!user) redirect(`/${locale}/login`);
  if (!/^[0-9a-f-]{36}$/.test(target) || target === user.id) return;
  if (formData.get("unblock") === "1") await unblockUser(user.id, target);
  else await blockUser(user.id, target);
  revalidatePath(`/${locale}`, "layout");
  // Yalnızca uygulama içi bir sayfaya geri dönülür.
  if (back.startsWith(`/${locale}/`) && !back.startsWith("//")) redirect(back);
}
