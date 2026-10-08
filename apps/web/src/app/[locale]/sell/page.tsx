import { getDb } from "@ormaro/db";
import { categoryKeys, cities, cityName, conditions, localeNames, locales, type Locale } from "@ormaro/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getUser } from "@/lib/listings";
import { requireUser } from "@/lib/session";
import { isStorageConfigured } from "@/lib/storage";
import { SellForm } from "./SellForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sell" });
  return { title: t("title") };
}

export default async function SellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/sell");
  const t = await getTranslations("sell");
  const tc = await getTranslations("categories");
  const tcond = await getTranslations("conditions");
  const loc = locale as Locale;

  if (!isStorageConfigured() || !getDb()) {
    return (
      <div className="px-4 py-6">
        <h1 className="mb-3 text-xl font-bold">{t("title")}</h1>
        <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-muted">
          {t("errors.storageMissing")}
        </p>
      </div>
    );
  }

  const profile = await getUser(user.id);

  return (
    <SellForm
      locale={locale}
      defaultCity={profile?.cityKey ?? ""}
      categories={categoryKeys.map((k) => ({ value: k, label: tc(k) }))}
      conditions={conditions.map((c) => ({ value: c, label: tcond(c) }))}
      cities={[...cities]
        .map((c) => ({ value: c.key, label: cityName(c.key, loc) }))
        .sort((a, b) => a.label.localeCompare(b.label))}
      languages={locales.map((l) => ({ value: l, label: localeNames[l] }))}
    />
  );
}
