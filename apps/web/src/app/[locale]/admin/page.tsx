import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { formatRelative } from "@/lib/format";
import { banUser, closeReport, removeListingAsAdmin, reportQueue, unbanUser } from "@/lib/reports";
import { getActiveUser, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const uuid = /^[0-9a-f-]{36}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, "/admin");
  const me = await getActiveUser();
  if (!me || me.role !== "admin") notFound();
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "closed" ? "closed" : "open";
  const t = await getTranslations("admin");
  const tr = await getTranslations("report");
  const tc = await getTranslations("chat");
  const queue = await reportQueue(tab);

  async function act(formData: FormData) {
    "use server";
    const admin = await getActiveUser();
    if (!admin || admin.role !== "admin") return;
    const action = String(formData.get("action") ?? "");
    const reportId = String(formData.get("reportId") ?? "");
    const targetId = String(formData.get("targetId") ?? "");
    if (!uuid.test(reportId)) return;
    if (action !== "close" && !uuid.test(targetId)) return;
    if (action === "removeListing") await removeListingAsAdmin(targetId);
    if (action === "ban" && targetId !== admin.id) await banUser(targetId);
    if (action === "unban") await unbanUser(targetId);
    if (action !== "unban") await closeReport(reportId, admin.id);
    revalidatePath(`/${locale}/admin`);
  }

  const tabCls = (active: boolean) =>
    "flex min-h-11 items-center justify-center rounded-[9px] text-sm " +
    (active ? "bg-white font-bold text-ink" : "font-semibold text-muted");

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 border-b border-line bg-white px-4 py-4">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <nav aria-label={t("title")} className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
          <Link href="/admin" aria-current={tab === "open" ? "page" : undefined} className={tabCls(tab === "open")}>
            {t("open")}
          </Link>
          <Link
            href={{ pathname: "/admin", query: { tab: "closed" } }}
            aria-current={tab === "closed" ? "page" : undefined}
            className={tabCls(tab === "closed")}
          >
            {t("closed")}
          </Link>
        </nav>
      </section>

      <section className="flex flex-col gap-3 px-4 py-4">
        {queue.length === 0 && (
          <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-muted">{t("empty")}</p>
        )}
        {queue.map((r) => {
          const banTarget = r.targetType === "listing" ? r.listingOwnerId : r.userId;
          const banned = r.targetType === "user" && r.userBannedAt;
          return (
            <article key={r.id} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-deep">
                  {tr(`reasons.${r.reason}`)}
                </span>
                <span className="text-xs text-muted">{formatRelative(r.createdAt, locale)}</span>
              </div>
              {r.targetType === "listing" ? (
                <p className="text-[15px]">
                  <span className="text-muted">{t("listing")}: </span>
                  {r.listingId ? (
                    <Link href={`/listing/${r.listingId}`} className="font-semibold underline">
                      {r.listingTitle}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {r.listingStatus && r.listingStatus !== "active" && (
                    <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{tc(`listingStatus.${r.listingStatus}`)}</span>
                  )}
                  <br />
                  <span className="text-muted">{t("owner")}: </span>
                  {r.listingOwnerId ? (
                    <Link href={`/user/${r.listingOwnerId}`} className="underline">
                      {r.listingOwnerName ?? "—"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </p>
              ) : (
                <p className="text-[15px]">
                  <span className="text-muted">{t("user")}: </span>
                  <span className="font-semibold">{r.userName ?? "—"}</span>
                  {r.userEmail && <span className="text-muted"> · {r.userEmail}</span>}
                  {banned && <span className="ml-2 rounded-full bg-[#FDF0EC] px-2 py-0.5 text-xs text-[#9A2B12]">{t("banned")}</span>}
                </p>
              )}
              {r.details && <p className="rounded-xl bg-surface p-2.5 text-sm whitespace-pre-line">{r.details}</p>}
              <p className="text-xs text-muted">
                {t("reporter")}: {r.reporterName ?? "—"} · {r.reporterEmail}
              </p>
              <div className="flex flex-wrap gap-2">
                {tab === "open" && (
                  <AdminButton act={act} action="close" reportId={r.id} label={t("dismiss")} />
                )}
                {tab === "open" && r.targetType === "listing" && r.listingId && r.listingStatus !== "removed" && (
                  <AdminButton act={act} action="removeListing" reportId={r.id} targetId={r.listingId} label={t("removeListing")} />
                )}
                {banTarget && !banned && tab === "open" && (
                  <AdminButton act={act} action="ban" reportId={r.id} targetId={banTarget} label={t("ban")} danger />
                )}
                {banned && r.userId && (
                  <AdminButton act={act} action="unban" reportId={r.id} targetId={r.userId} label={t("unban")} />
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function AdminButton({
  act,
  action,
  reportId,
  targetId,
  label,
  danger,
}: {
  act: (fd: FormData) => Promise<void>;
  action: string;
  reportId: string;
  targetId?: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={act}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="reportId" value={reportId} />
      {targetId && <input type="hidden" name="targetId" value={targetId} />}
      <button
        type="submit"
        className={
          "min-h-11 rounded-xl px-3.5 text-sm font-bold " +
          (danger ? "bg-[#9A2B12] text-white" : "border border-field bg-white text-ink")
        }
      >
        {label}
      </button>
    </form>
  );
}
