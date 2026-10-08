import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { bothParticipated, getConversation } from "@/lib/messages";
import { createReview, existingReview } from "@/lib/reviews";
import { getActiveUser, requireUser } from "@/lib/session";
import { StarInput } from "./StarInput";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; conversationId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return { title: t("title") };
}

export default async function ReviewPage({ params, searchParams }: Props) {
  const { locale, conversationId } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/review/${conversationId}`);
  const data = await getConversation(conversationId, user.id);
  if (!data) notFound();
  const t = await getTranslations("review");
  const { error } = await searchParams;
  const allowed = bothParticipated(data.messages, data.conversation.buyerId, data.conversation.sellerId);
  const already = await existingReview(user.id, data.listing.id);
  const name = data.other.name ?? t("someone");

  async function submit(formData: FormData) {
    "use server";
    const me = await getActiveUser();
    if (!me) redirect(`/${locale}/login`);
    const fresh = await getConversation(conversationId, me.id);
    if (!fresh || !bothParticipated(fresh.messages, fresh.conversation.buyerId, fresh.conversation.sellerId)) {
      redirect(`/${locale}/messages/${conversationId}`);
    }
    const rating = Number(formData.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      redirect(`/${locale}/review/${conversationId}?error=rating`);
    }
    const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);
    await createReview({
      authorId: me.id,
      subjectId: fresh.other.id,
      listingId: fresh.listing.id,
      rating,
      comment,
    });
    redirect(`/${locale}/user/${fresh.other.id}`);
  }

  if (!allowed || already) {
    return (
      <div className="flex flex-col gap-4 bg-white px-4 py-6">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-[15px] text-muted">{already ? t("already") : t("notAllowed")}</p>
        <Link href={`/messages/${conversationId}`} className="font-semibold text-brand-strong">
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-6 bg-white px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted">{data.listing.title}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-[#FDF0EC] p-3 text-[15px] font-semibold text-[#9A2B12]">
          {t("ratingRequired")}
        </p>
      )}
      <fieldset className="flex flex-col items-center gap-3">
        <legend className="mb-3 w-full text-center text-[19px] font-bold">{t("question", { name })}</legend>
        <StarInput
          labels={[t("stars.1"), t("stars.2"), t("stars.3"), t("stars.4"), t("stars.5")]}
        />
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="comment" className="text-[15px] font-bold">
          {t("commentLabel")} <span className="font-normal text-muted">{t("optional")}</span>
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          maxLength={1000}
          className="rounded-xl border border-field px-3.5 py-3 text-[15px] focus:border-brand-strong focus:outline-none"
        />
        <p className="text-[13px] text-muted">{t("commentHint", { name })}</p>
      </div>
      <button type="submit" className="min-h-13 rounded-xl bg-brand font-bold text-ink">
        {t("submit")}
      </button>
    </form>
  );
}
