import { getDb } from "@ormaro/db";
import {
  categoryKeys,
  cities,
  cityName,
  conditions,
  type CategoryKey,
  type Condition,
  type Locale,
} from "@ormaro/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchIcon } from "@/components/icons";
import { ListingList } from "@/components/ListingCards";
import { SortSelect } from "@/components/SortSelect";
import { Link } from "@/i18n/navigation";
import { searchListings, type SearchFilters } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("title") };
}

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseFilters(sp: Params): SearchFilters {
  const category = one(sp.category);
  const city = one(sp.city);
  const condition = one(sp.condition);
  const sort = one(sp.sort);
  return {
    q: one(sp.q)?.slice(0, 100),
    category: categoryKeys.includes(category as CategoryKey) ? (category as CategoryKey) : undefined,
    city: cities.some((c) => c.key === city) ? city : undefined,
    condition: conditions.includes(condition as Condition) ? (condition as Condition) : undefined,
    min: num(one(sp.min)),
    max: num(one(sp.max)),
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "new",
  };
}

const field =
  "h-12 w-full rounded-xl border border-field bg-white px-3 text-[15px] text-ink focus:border-brand-strong focus:outline-none";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Params>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("search");
  const tc = await getTranslations("categories");
  const tcond = await getTranslations("conditions");
  const f = parseFilters(await searchParams);
  const items = getDb() ? await searchListings(f) : [];
  const activeFilters = [f.category, f.city, f.condition, f.min, f.max].filter(
    (v) => v !== undefined,
  ).length;
  const sortedCities = [...cities].sort((a, b) =>
    cityName(a.key, locale as Locale).localeCompare(cityName(b.key, locale as Locale)),
  );

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="sr-only">{t("title")}</h1>
      <form action={`/${locale}/search`} method="get" className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            {t("placeholder")}
          </label>
          <div className="flex flex-1 items-center gap-2 rounded-xl border-2 border-brand-strong bg-white px-3">
            <SearchIcon width={20} height={20} className="flex-none text-muted" />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={f.q}
              placeholder={t("placeholder")}
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </div>
          <button
            type="submit"
            className="min-h-12 flex-none rounded-xl bg-brand px-4 font-bold text-ink"
          >
            {t("submit")}
          </button>
        </div>

        <details open={activeFilters > 0} className="rounded-2xl border border-line bg-white">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">
            {t("filters")}
            {activeFilters > 0 && (
              <span className="ml-2 rounded-full bg-brand-tint px-2 text-sm text-brand-deep">
                {activeFilters}
              </span>
            )}
          </summary>
          <div className="grid grid-cols-2 gap-3 px-4 pb-4">
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="category" className="text-sm font-semibold">
                {t("category")}
              </label>
              <select id="category" name="category" defaultValue={f.category ?? ""} className={field}>
                <option value="">{t("allCategories")}</option>
                {categoryKeys.map((k) => (
                  <option key={k} value={k}>
                    {tc(k)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="city" className="text-sm font-semibold">
                {t("city")}
              </label>
              <select id="city" name="city" defaultValue={f.city ?? ""} className={field}>
                <option value="">{t("allCities")}</option>
                {sortedCities.map((c) => (
                  <option key={c.key} value={c.key}>
                    {cityName(c.key, locale as Locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="min" className="text-sm font-semibold">
                {t("priceMin")}
              </label>
              <input id="min" name="min" type="number" min={0} inputMode="numeric" defaultValue={f.min} className={field} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="max" className="text-sm font-semibold">
                {t("priceMax")}
              </label>
              <input id="max" name="max" type="number" min={0} inputMode="numeric" defaultValue={f.max} className={field} />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="condition" className="text-sm font-semibold">
                {t("condition")}
              </label>
              <select id="condition" name="condition" defaultValue={f.condition ?? ""} className={field}>
                <option value="">{t("anyCondition")}</option>
                {conditions.map((c) => (
                  <option key={c} value={c}>
                    {tcond(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <Link
                href="/search"
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-field bg-white font-semibold"
              >
                {t("clear")}
              </Link>
              <button type="submit" className="min-h-12 flex-[1.5] rounded-xl bg-brand font-bold text-ink">
                {t("apply")}
              </button>
            </div>
          </div>
        </details>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            {t("results", { count: items.length })}
          </p>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span className="sr-only">{t("sort")}</span>
            <SortSelect defaultValue={f.sort ?? "new"}>
              <option value="new">{t("sortNew")}</option>
              <option value="price_asc">{t("sortPriceAsc")}</option>
              <option value="price_desc">{t("sortPriceDesc")}</option>
            </SortSelect>
          </label>
        </div>
      </form>

      {items.length > 0 ? (
        <ListingList items={items} />
      ) : (
        <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-muted">
          {t("noResults")}
        </p>
      )}
    </div>
  );
}
