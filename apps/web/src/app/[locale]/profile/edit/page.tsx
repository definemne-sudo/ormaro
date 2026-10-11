import { cities, cityName, type Locale } from "@ormaro/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getUser } from "@/lib/listings";
import { requireUser } from "@/lib/session";
import { isStorageConfigured, photoSrc } from "@/lib/storage";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profileEdit" });
  return { title: t("title") };
}

export default async function ProfileEditPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/profile/edit");
  const profile = await getUser(user.id);
  const url = profile?.avatarUrl ?? null;
  const avatarSrc = url ? (url.startsWith("https://") ? url : isStorageConfigured() ? photoSrc(url) : null) : null;

  return (
    <ProfileForm
      locale={locale}
      name={profile?.name ?? ""}
      cityKey={profile?.cityKey ?? ""}
      avatarSrc={avatarSrc}
      cities={[...cities]
        .map((c) => ({ value: c.key, label: cityName(c.key, locale as Locale) }))
        .sort((a, b) => a.label.localeCompare(b.label))}
    />
  );
}
