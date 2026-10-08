import { getDb } from "@ormaro/db";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/ListingCards";
import { Stars } from "@/components/Stars";
import { Link } from "@/i18n/navigation";
import { formatMonthYear, formatRelative } from "@/lib/format";
import { getUser, listingsBySeller } from "@/lib/listings";
import { ratingSummary, reviewsAbout } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!getDb() || !/^[0-9a-f-]{36}$/.test(id)) return {};
  const u = await getUser(id);
  return u?.name ? { title: u.name } : {};
}

export default async function UserPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!getDb() || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await getUser(id);
  if (!u || u.bannedAt) notFound();
  const t = await getTranslations("user");
  const [items, summary, reviews, me] = await Promise.all([
    listingsBySeller(id, false),
    ratingSummary(id),
    reviewsAbout(id),
    getCurrentUser(),
  ]);
  const avg = summary.average !== null ? summary.average.toFixed(1).replace(".", locale === "en" ? "." : ",") : null;

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 border-b border-line bg-white px-4 py-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-tint text-2xl font-bold text-brand-deep">
            {(u.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-xl font-bold">{u.name ?? t("someone")}</h1>
            <p className="text-sm text-muted">{t("memberSince", { date: formatMonthYear(u.createdAt, locale) })}</p>
            {avg ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Stars value={summary.average ?? 0} label={t("ratingLabel", { avg })} />
                {t("rating", { avg, count: summary.count })}
              </p>
            ) : (
              <p className="text-sm text-muted">{t("noRatings")}</p>
            )}
          </div>
        </div>
        {me && me.id !== u.id && (
          <Link
            href={{ pathname: "/report", query: { user: u.id } }}
            className="self-start text-sm font-semibold text-muted underline"
          >
            {t("report")}
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-2.5 px-4 py-4">
        <h2 className="text-base font-bold">{t("listings")}</h2>
        {items.length > 0 ? (
          <ListingGrid items={items} />
        ) : (
          <p className="rounded-2xl border border-line bg-white p-4 text-[15px] text-muted">{t("noListings")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2.5 px-4 pb-4">
        <h2 className="text-base font-bold">{t("reviews")}</h2>
        {reviews.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{r.authorName ?? t("someone")}</span>
                  <Stars value={r.rating} size={14} label={`${r.rating} / 5`} />
                </div>
                {r.comment && <p className="text-[15px] leading-relaxed whitespace-pre-line">{r.comment}</p>}
                <p className="text-xs text-muted">
                  {r.listingTitle ? `${r.listingTitle} · ` : ""}
                  {formatRelative(r.createdAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-line bg-white p-4 text-[15px] text-muted">{t("noReviews")}</p>
        )}
      </section>
    </div>
  );
}
