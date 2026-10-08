import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImageIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatPrice, formatRelative } from "@/lib/format";
import { listConversations } from "@/lib/messages";
import { requireUser } from "@/lib/session";
import { photoSrc } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat" });
  return { title: t("title") };
}

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/messages");
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "buying" || tabParam === "selling" ? tabParam : "all";
  const t = await getTranslations("chat");
  const rows = await listConversations(user.id, tab);

  const tabs = [
    { key: "all", label: t("tabs.all") },
    { key: "buying", label: t("tabs.buying") },
    { key: "selling", label: t("tabs.selling") },
  ] as const;

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3.5 border-b border-line bg-white px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <nav aria-label={t("title")} className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
          {tabs.map((x) => (
            <Link
              key={x.key}
              href={x.key === "all" ? "/messages" : { pathname: "/messages", query: { tab: x.key } }}
              aria-current={tab === x.key ? "page" : undefined}
              className={
                "flex min-h-11 items-center justify-center rounded-[9px] text-sm " +
                (tab === x.key ? "bg-white font-bold text-ink" : "font-semibold text-muted")
              }
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </section>

      {rows.length === 0 ? (
        <p className="m-4 rounded-2xl border border-line bg-white p-5 text-[15px] text-muted">{t("empty")}</p>
      ) : (
        <ul className="bg-white">
          {rows.map((r) => {
            const preview =
              r.lastKind === "offer"
                ? t("offerPreview", { amount: formatPrice(r.lastOffer ?? 0, locale) })
                : (r.lastBody ?? "");
            return (
              <li key={r.id} className="border-b border-line">
                <Link href={`/messages/${r.id}`} className="flex items-center gap-3 px-4 py-3.5">
                  {r.coverKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoSrc(r.coverKey)} alt="" className="h-13 w-13 flex-none rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-13 w-13 flex-none items-center justify-center rounded-xl bg-placeholder text-muted">
                      <ImageIcon width={22} height={22} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-bold">{r.otherName ?? t("someone")}</span>
                      <span className="flex-none text-xs text-muted">{formatRelative(r.lastMessageAt, locale)}</span>
                    </span>
                    <span className="truncate text-[13px] text-muted">
                      {r.listingTitle} · {formatPrice(r.listingPrice, locale)}
                      {r.role === "seller" ? ` · ${t("yourListing")}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          "min-w-0 flex-1 truncate text-sm " +
                          (r.unread > 0 ? "font-bold text-ink" : "text-muted")
                        }
                      >
                        {r.lastFromMe ? `${t("you")}: ` : ""}
                        {preview}
                      </span>
                      {r.unread > 0 && (
                        <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-ink">
                          <span className="sr-only">{t("unread")}: </span>
                          {r.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
