import { categoryKeys, cities, cityName, conditions, localeNames, locales, type Locale } from "@ormaro/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getListing } from "@/lib/listings";
import { requireUser } from "@/lib/session";
import { photoSrc } from "@/lib/storage";
import { SellForm } from "../../../sell/SellForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sell" });
  return { title: t("editTitle") };
}

export default async function EditListingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/listing/${id}/edit`);
  const data = await getListing(id);
  // Yalnızca ilanın sahibi düzenleyebilir; kaldırılan ilanlar da düzenlenebilir.
  if (!data || data.listing.sellerId !== user.id) notFound();
  const tc = await getTranslations("categories");
  const tcond = await getTranslations("conditions");
  const loc = locale as Locale;
  const l = data.listing;

  return (
    <SellForm
      locale={locale}
      defaultCity={l.cityKey}
      categories={categoryKeys.map((k) => ({ value: k, label: tc(k) }))}
      conditions={conditions.map((c) => ({ value: c, label: tcond(c) }))}
      cities={[...cities]
        .map((c) => ({ value: c.key, label: cityName(c.key, loc) }))
        .sort((a, b) => a.label.localeCompare(b.label))}
      languages={locales.map((x) => ({ value: x, label: localeNames[x] }))}
      edit={{
        listingId: l.id,
        values: {
          title: l.title,
          description: l.description,
          price: String(l.priceEuro),
          categoryKey: l.categoryKey,
          condition: l.condition,
          cityKey: l.cityKey,
          language: l.language,
        },
        photos: data.photos.map((key) => ({ key, src: photoSrc(key) })),
      }}
    />
  );
}
