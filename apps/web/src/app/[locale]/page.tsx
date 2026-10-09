import { getDb } from "@ormaro/db";
import { categoryKeys, locales, type Locale } from "@ormaro/shared";
import { after } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchIcon } from "@/components/icons";
import { ListingGrid } from "@/components/ListingCards";
import { Link } from "@/i18n/navigation";
import { latestListings } from "@/lib/listings";
import { translateMissing } from "@/lib/translate";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("categories");
  const items = getDb() ? await latestListings(locale as Locale, 24) : [];
  // Çevirisi eksik eski ilanlar sayfa gönderildikten sonra arka planda tamamlanır.
  if (getDb()) {
    after(async () => {
      for (const l of locales) await translateMissing(l, 5);
    });
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold tracking-tight">{t("tagline")}</h1>
        <Link
          href="/search"
          className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 text-[15px] text-muted"
        >
          <SearchIcon width={20} height={20} />
          {t("searchPlaceholder")}
        </Link>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-base font-bold">{t("categoriesTitle")}</h2>
        <ul className="grid grid-cols-3 gap-2">
          {categoryKeys.map((key) => (
            <li key={key}>
              <Link
                href={{ pathname: "/search", query: { category: key } }}
                className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-white px-1.5 text-center text-[13px] leading-tight font-semibold"
              >
                {tc(key)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-base font-bold">{t("latestTitle")}</h2>
        {items.length > 0 ? (
          <ListingGrid items={items} />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-white p-5">
            <p className="text-[15px] text-muted">{t("empty")}</p>
            <Link
              href="/sell"
              className="flex min-h-12 items-center rounded-xl bg-brand px-5 font-bold text-ink"
            >
              {t("sellCta")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
