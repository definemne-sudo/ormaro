import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { signOut } from "@/auth";
import { ListingList } from "@/components/ListingCards";
import { Link } from "@/i18n/navigation";
import { formatMonthYear } from "@/lib/format";
import { favoriteListings, getUser, listingsBySeller } from "@/lib/listings";
import { getActiveUser, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("title") };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/profile");
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "favorites" ? "favorites" : "listings";
  const t = await getTranslations("profile");
  const [profile, active] = await Promise.all([getUser(user.id), getActiveUser()]);
  const items =
    tab === "favorites" ? await favoriteListings(user.id) : await listingsBySeller(user.id, true);

  async function logout() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  const tabCls = (active: boolean) =>
    "flex min-h-11 items-center justify-center rounded-[9px] text-sm " +
    (active ? "bg-white font-bold text-ink" : "font-semibold text-muted");

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-4 border-b border-line bg-white px-4 py-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-tint text-2xl font-bold text-brand-deep">
            {(profile?.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-xl font-bold">{profile?.name ?? user.email}</h1>
            {profile && (
              <p className="text-sm text-muted">
                {t("memberSince", { date: formatMonthYear(profile.createdAt, locale) })}
              </p>
            )}
          </div>
        </div>
        <nav aria-label={t("title")} className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
          <Link href="/profile" aria-current={tab === "listings" ? "page" : undefined} className={tabCls(tab === "listings")}>
            {t("myListings")}
          </Link>
          <Link
            href={{ pathname: "/profile", query: { tab: "favorites" } }}
            aria-current={tab === "favorites" ? "page" : undefined}
            className={tabCls(tab === "favorites")}
          >
            {t("favorites")}
          </Link>
        </nav>
      </section>

      <section className="flex flex-col gap-3 px-4 py-4">
        {items.length > 0 ? (
          <ListingList items={items} />
        ) : (
          <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-muted">
            {tab === "favorites" ? t("emptyFavorites") : t("emptyListings")}
          </p>
        )}
        {tab === "listings" && (
          <Link
            href="/sell"
            className="flex min-h-13 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-brand-strong font-bold text-brand-strong"
          >
            {t("newListing")}
          </Link>
        )}
      </section>

      <nav className="flex flex-col gap-2 px-4 pb-3">
        <Link
          href={`/user/${user.id}`}
          className="flex min-h-12 items-center justify-center rounded-xl border border-field bg-white font-semibold"
        >
          {t("publicProfile")}
        </Link>
        {active?.role === "admin" && (
          <Link
            href="/admin"
            className="flex min-h-12 items-center justify-center rounded-xl border border-field bg-white font-semibold"
          >
            {t("admin")}
          </Link>
        )}
      </nav>

      <form action={logout} className="px-4 pb-4">
        <button
          type="submit"
          className="min-h-12 w-full rounded-xl border border-field bg-white font-bold text-ink"
        >
          {t("logout")}
        </button>
      </form>
    </div>
  );
}
