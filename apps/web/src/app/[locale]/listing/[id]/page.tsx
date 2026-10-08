import { getDb } from "@ormaro/db";
import { cityName, localeNames, type Locale } from "@ormaro/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { HeartIcon, ImageIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatMonthYear, formatPrice, formatRelative } from "@/lib/format";
import { getListing, isFavorite } from "@/lib/listings";
import { getCurrentUser } from "@/lib/session";
import { photoSrc } from "@/lib/storage";
import { setStatusAction, toggleFavoriteAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!getDb()) return {};
  const data = await getListing(id);
  return data ? { title: data.listing.title } : {};
}

export default async function ListingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!getDb()) notFound();
  const data = await getListing(id);
  const user = await getCurrentUser();
  const isOwner = user?.id === data?.listing.sellerId;
  if (!data || (data.listing.status === "removed" && !isOwner)) notFound();

  const t = await getTranslations("listing");
  const tc = await getTranslations("categories");
  const tcond = await getTranslations("conditions");
  const { listing, seller, photos } = data;
  const fav = user ? await isFavorite(user.id, listing.id) : false;
  const loc = locale as Locale;

  return (
    <article className="flex flex-col bg-white">
      {photos.length > 0 ? (
        <div className="flex snap-x snap-mandatory overflow-x-auto bg-placeholder" aria-label={t("photos")}>
          {photos.map((key, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={photoSrc(key)}
              alt={t("photoAlt", { n: i + 1, total: photos.length })}
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-[4/3] w-full flex-none snap-center object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-placeholder text-muted">
          <ImageIcon width={44} height={44} />
        </div>
      )}
      {photos.length > 1 && (
        <p className="px-4 pt-2 text-xs text-muted">{t("swipeHint", { total: photos.length })}</p>
      )}

      <div className="flex flex-col gap-4 px-4 py-4">
        {listing.status !== "active" && (
          <p className="self-start rounded-full bg-line px-3 py-1 text-sm font-bold">
            {t(`status.${listing.status}`)}
          </p>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-[28px] leading-none font-bold tracking-tight">
              {formatPrice(listing.priceEuro, loc)}
            </p>
            <h1 className="text-[19px] leading-snug font-semibold">{listing.title}</h1>
            <p className="text-sm text-muted">
              {cityName(listing.cityKey, loc)} · {formatRelative(listing.createdAt, loc)}
            </p>
          </div>
          {!isOwner && (
            <form action={toggleFavoriteAction}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                aria-pressed={fav}
                aria-label={fav ? t("unfavorite") : t("favorite")}
                className={
                  "flex h-12 w-12 items-center justify-center rounded-full border " +
                  (fav ? "border-brand-strong bg-brand-tint text-brand-strong" : "border-line text-ink")
                }
              >
                <HeartIcon filled={fav} />
              </button>
            </form>
          )}
        </div>

        <ul className="flex flex-wrap gap-2 text-[13px] font-semibold">
          <li className="rounded-full bg-surface px-3 py-1.5">{tcond(listing.condition)}</li>
          <li className="rounded-full bg-surface px-3 py-1.5">{tc(listing.categoryKey)}</li>
          <li className="rounded-full bg-surface px-3 py-1.5">
            {t("writtenIn", { language: localeNames[listing.language] })}
          </li>
        </ul>

        {listing.description && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-[15px] font-bold">{t("description")}</h2>
            <p
              lang={listing.language === "me" ? "cnr" : listing.language}
              className="text-[15px] leading-relaxed whitespace-pre-line"
            >
              {listing.description}
            </p>
          </section>
        )}

        <section className="flex items-center gap-3 rounded-2xl border border-line p-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-tint text-lg font-bold text-brand-deep">
            {(seller.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="flex flex-col">
            <span className="text-[15px] font-bold">{seller.name ?? t("anonymous")}</span>
            <span className="text-[13px] text-muted">
              {t("memberSince", { date: formatMonthYear(seller.createdAt, loc) })}
            </span>
          </span>
        </section>

        {isOwner ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold">{t("ownerTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              {listing.status === "active" ? (
                <>
                  <StatusButton id={listing.id} locale={locale} status="sold" label={t("markSold")} primary />
                  <StatusButton id={listing.id} locale={locale} status="removed" label={t("remove")} />
                </>
              ) : (
                <StatusButton id={listing.id} locale={locale} status="active" label={t("reactivate")} primary />
              )}
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-2">
            <button
              type="button"
              disabled
              className="min-h-13 rounded-xl bg-brand font-bold text-ink opacity-60"
            >
              {t("message")}
            </button>
            <p className="text-center text-sm text-muted">{t("messagingSoon")}</p>
            {!user && (
              <Link
                href={{ pathname: "/login", query: { next: `/${locale}/listing/${listing.id}` } }}
                className="text-center text-sm font-semibold text-brand-strong"
              >
                {t("loginToFavorite")}
              </Link>
            )}
          </section>
        )}
      </div>
    </article>
  );
}

function StatusButton({
  id,
  locale,
  status,
  label,
  primary,
}: {
  id: string;
  locale: string;
  status: "active" | "sold" | "removed";
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={setStatusAction} className="flex-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={
          "min-h-12 w-full rounded-xl px-4 font-bold " +
          (primary ? "bg-brand text-ink" : "border border-field bg-white text-ink")
        }
      >
        {label}
      </button>
    </form>
  );
}
