import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getListing, getUser } from "@/lib/listings";
import { createReport, reportReasons, type ReportReason } from "@/lib/reports";
import { getActiveUser, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ listing?: string; user?: string; done?: string; error?: string }>;
};

const uuid = /^[0-9a-f-]{36}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "report" });
  return { title: t("title") };
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const query = sp.listing ? `?listing=${sp.listing}` : sp.user ? `?user=${sp.user}` : "";
  const me = await requireUser(locale, `/report${query}`);
  const t = await getTranslations("report");

  if (sp.done) {
    return (
      <div className="flex flex-col gap-4 bg-white px-4 py-6">
        <h1 className="text-xl font-bold">{t("doneTitle")}</h1>
        <p className="text-[15px] text-muted">{t("doneBody")}</p>
        <Link href="/" className="font-semibold text-brand-strong">
          {t("home")}
        </Link>
      </div>
    );
  }

  let subject: string;
  let target: { type: "listing"; listingId: string } | { type: "user"; userId: string };
  if (sp.listing && uuid.test(sp.listing)) {
    const l = await getListing(sp.listing);
    if (!l || l.listing.sellerId === me.id) notFound();
    subject = l.listing.title;
    target = { type: "listing", listingId: l.listing.id };
  } else if (sp.user && uuid.test(sp.user)) {
    const u = await getUser(sp.user);
    if (!u || u.id === me.id) notFound();
    subject = u.name ?? t("someone");
    target = { type: "user", userId: u.id };
  } else {
    notFound();
  }

  async function submit(formData: FormData) {
    "use server";
    const user = await getActiveUser();
    if (!user) redirect(`/${locale}/login`);
    const reason = String(formData.get("reason") ?? "") as ReportReason;
    if (!reportReasons.includes(reason)) redirect(`/${locale}/report${query}&error=reason`);
    const details = String(formData.get("details") ?? "").trim().slice(0, 1000);
    await createReport({ reporterId: user.id, target, reason, details });
    redirect(`/${locale}/report${query}&done=1`);
  }

  return (
    <form action={submit} className="flex flex-col gap-5 bg-white px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{target.type === "listing" ? t("titleListing") : t("titleUser")}</h1>
        <p className="text-sm text-muted">{subject}</p>
      </div>
      {sp.error && (
        <p role="alert" className="rounded-xl bg-[#FDF0EC] p-3 text-[15px] font-semibold text-[#9A2B12]">
          {t("reasonRequired")}
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-bold">{t("reasonLabel")}</legend>
        {reportReasons.map((r) => (
          <label
            key={r}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 has-[:checked]:border-brand-strong has-[:checked]:bg-brand-tint"
          >
            <input type="radio" name="reason" value={r} required className="h-5 w-5 accent-[#c2410c]" />
            <span className="text-[15px]">{t(`reasons.${r}`)}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="details" className="text-[15px] font-bold">
          {t("detailsLabel")} <span className="font-normal text-muted">{t("optional")}</span>
        </label>
        <textarea
          id="details"
          name="details"
          rows={4}
          maxLength={1000}
          className="rounded-xl border border-field px-3.5 py-3 text-[15px] focus:border-brand-strong focus:outline-none"
        />
      </div>
      <p className="text-[13px] text-muted">{t("privacy")}</p>
      <button type="submit" className="min-h-13 rounded-xl bg-brand font-bold text-ink">
        {t("submit")}
      </button>
    </form>
  );
}
