import { getDb } from "@ormaro/db";
import { cityName, localeNames, type Locale } from "@ormaro/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { HeartIcon, ImageIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatMonthYear, formatPrice, formatRelative } from "@/lib/format";
import { getListing, isFavorite } from "@/lib/listings";
import { ratingSummary } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/session";
import { photoSrc } from "@/lib/storage";
import { ensureTranslation, existingTranslation } from "@/lib/translate";
import { Stars } from "@/components/Stars";
import { startConversationAction } from "../../messages/actions";
import { setStatusAction, toggleFavoriteAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ original?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params;
  if (!getDb()) return {};
  const data = await getListing(id);
  if (!data) return {};
  const tr = await existingTranslation(data.listing.id, locale as Locale);
  return { title: tr?.title ?? data.listing.title };
}

export default async function ListingPage({ params, searchParams }: Props) {
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
  const [fav, rating] = await Promise.all([
    user ? isFavorite(user.id, listing.id) : Promise.resolve(false),
    ratingSummary(seller.id),
  ]);
  const avg =
    rating.average !== null ? rating.average.toFixed(1).replace(".", locale === "en" ? "." : ",") : null;
  const loc = locale as Locale;
  // İlan başka dilde yazıldıysa alıcının diline çevrilmiş hâli gösterilir; ilk görüntülemede çevrilir.
  const translation = await ensureTranslation(listing, loc);
  const showOriginal = (await searchParams).original === "1";
  const shown = translation && !showOriginal ? translation : null;
  const title = shown?.title ?? listing.title;
  const description = shown ? shown.description : listing.description;
  const textLang = shown ? (loc === "me" ? "cnr" : loc) : listing.language === "me" ? "cnr" : listing.language;

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
            <h1 lang={textLang} className="text-[19px] leading-snug font-semibold">{title}</h1>
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
          {!translation && (
            <li className="rounded-full bg-surface px-3 py-1.5">
              {t("writtenIn", { language: localeNames[listing.language] })}
            </li>
          )}
        </ul>

        {translation && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface px-3 py-2 text-[13px] text-muted">
            <span>
              {showOriginal
                ? t("originalShown", { language: localeNames[listing.language] })
                : t("translatedFrom", { language: localeNames[listing.language] })}
            </span>
            <Link
              href={showOriginal ? `/listing/${listing.id}` : { pathname: `/listing/${listing.id}`, query: { original: "1" } }}
              replace
              className="font-semibold text-brand-strong underline"
            >
              {showOriginal ? t("showTranslation") : t("showOriginal")}
            </Link>
          </p>
        )}

        {description && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-[15px] font-bold">{t("description")}</h2>
            <p lang={textLang} className="text-[15px] leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </section>
        )}

        <Link
          href={`/user/${seller.id}`}
          className="flex items-center gap-3 rounded-2xl border border-line p-3"
        >
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-tint text-lg font-bold text-brand-deep">
            {(seller.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-bold">{seller.name ?? t("anonymous")}</span>
            {avg ? (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Stars value={rating.average ?? 0} size={14} label={t("ratingLabel", { avg })} />
                {t("rating", { avg, count: rating.count })}
              </span>
            ) : (
              <span className="text-[13px] text-muted">
                {t("memberSince", { date: formatMonthYear(seller.createdAt, loc) })}
              </span>
            )}
          </span>
          <span aria-hidden="true" className="text-muted">›</span>
        </Link>

        {isOwner ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold">{t("ownerTitle")}</h2>
            <Link
              href={{ pathname: "/messages", query: { tab: "selling" } }}
              className="flex min-h-12 items-center justify-center rounded-xl border border-field font-bold"
            >
              {t("ownerMessages")}
            </Link>
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
          <section className="flex flex-col gap-3">
            {listing.status === "active" && (
              <form action={startConversationAction}>
                <input type="hidden" name="listingId" value={listing.id} />
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="min-h-13 w-full rounded-xl bg-brand font-bold text-ink">
                  {t("message")}
                </button>
              </form>
            )}
            <p className="rounded-xl bg-brand-tint px-3 py-2 text-center text-[13px] text-brand-deep">{t("safety")}</p>
            {user && (
              <Link
                href={{ pathname: "/report", query: { listing: listing.id } }}
                className="self-center text-sm font-semibold text-muted underline"
              >
                {t("report")}
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
