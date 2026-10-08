import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BackIcon, ImageIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatPrice, intlLocale } from "@/lib/format";
import { bothParticipated, getConversation, markRead } from "@/lib/messages";
import { existingReview } from "@/lib/reviews";
import { requireUser } from "@/lib/session";
import { photoSrc } from "@/lib/storage";
import { setStatusAction } from "../../listing/[id]/actions";
import { respondOfferAction } from "../actions";
import { Composer } from "./Composer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat" });
  return { title: t("title") };
}

export default async function ConversationPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/messages/${id}`);
  const data = await getConversation(id, user.id);
  if (!data) notFound();
  await markRead(id, user.id);

  const t = await getTranslations("chat");
  const { listing, other, role, messages, conversation } = data;
  const accepted = messages.find((m) => m.offerStatus === "accepted");
  const canReview =
    bothParticipated(messages, conversation.buyerId, conversation.sellerId) &&
    !(await existingReview(user.id, listing.id));
  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long" });

  let lastDay = "";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <AutoRefresh seconds={5} />
      <header className="sticky top-[57px] z-10 flex flex-col border-b border-line bg-white">
        <div className="flex items-center gap-2 py-1.5 pr-4 pl-1">
          <Link href="/messages" aria-label={t("back")} className="flex h-11 w-11 items-center justify-center">
            <BackIcon width={22} height={22} />
          </Link>
          <Link href={`/user/${other.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint font-bold text-brand-deep">
              {(other.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-bold">{other.name ?? t("someone")}</span>
              <span className="text-xs text-muted">{role === "buyer" ? t("roleSeller") : t("roleBuyer")}</span>
            </span>
          </Link>
          <Link
            href={{ pathname: "/report", query: { user: other.id } }}
            className="flex min-h-11 items-center text-sm font-semibold text-muted"
          >
            {t("report")}
          </Link>
        </div>
        <Link href={`/listing/${listing.id}`} className="flex items-center gap-3 border-t border-line px-4 py-2.5">
          {data.coverKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoSrc(data.coverKey)} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-placeholder text-muted">
              <ImageIcon width={20} height={20} />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{listing.title}</span>
            <span className="text-sm font-bold">
              {formatPrice(listing.priceEuro, locale)}
              {listing.status !== "active" && (
                <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{t(`listingStatus.${listing.status}`)}</span>
              )}
            </span>
          </span>
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 px-4 py-4">
        <p className="mb-1 rounded-xl bg-brand-tint px-3 py-2 text-center text-[13px] text-brand-deep">{t("safety")}</p>

        {accepted && (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
            <p className="text-sm font-semibold">
              {t("acceptedNote", { amount: formatPrice(accepted.offerEuro ?? 0, locale) })}
            </p>
            {role === "seller" && listing.status === "active" && (
              <form action={setStatusAction}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="status" value="sold" />
                <button type="submit" className="min-h-11 w-full rounded-xl border border-field font-bold">
                  {t("markSold")}
                </button>
              </form>
            )}
          </div>
        )}

        {canReview && (
          <Link
            href={`/review/${conversation.id}`}
            className="flex min-h-11 items-center justify-center rounded-xl border border-field bg-white text-sm font-semibold"
          >
            {t("rate", { name: other.name ?? t("someone") })}
          </Link>
        )}

        <ol className="flex flex-col gap-2.5" aria-live="polite">
          {messages.map((m) => {
            const mine = m.senderId === user.id;
            const d = day.format(m.createdAt);
            const showDay = d !== lastDay;
            lastDay = d;
            return (
              <li key={m.id} className="flex flex-col gap-2.5">
                {showDay && <p className="self-center text-xs text-muted">{d}</p>}
                {m.kind === "offer" ? (
                  <div
                    className={
                      "flex w-[78%] flex-col gap-2 rounded-2xl border-[1.5px] border-brand-strong bg-white p-3 " +
                      (mine ? "self-end rounded-br-sm" : "self-start rounded-bl-sm")
                    }
                  >
                    <span className="text-xs font-bold text-brand-deep">{mine ? t("offerYours") : t("offerTheirs")}</span>
                    <span className="text-[22px] font-bold">{formatPrice(m.offerEuro ?? 0, locale)}</span>
                    <span className="text-[13px] text-muted">
                      {t(`offerStatus.${m.offerStatus ?? "pending"}`)} · {time.format(m.createdAt)}
                    </span>
                    {!mine && m.offerStatus === "pending" && (
                      <div className="flex gap-2">
                        <form action={respondOfferAction} className="flex-1">
                          <input type="hidden" name="messageId" value={m.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="accept" value="0" />
                          <button type="submit" className="min-h-11 w-full rounded-xl border border-field font-semibold">
                            {t("decline")}
                          </button>
                        </form>
                        <form action={respondOfferAction} className="flex-1">
                          <input type="hidden" name="messageId" value={m.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="accept" value="1" />
                          <button type="submit" className="min-h-11 w-full rounded-xl bg-brand font-bold text-ink">
                            {t("accept")}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-line " +
                      (mine
                        ? "self-end rounded-br-sm bg-brand text-ink"
                        : "self-start rounded-bl-sm border border-line bg-white")
                    }
                  >
                    {m.body}
                    <span className="mt-1 block text-right text-[11px] opacity-70">{time.format(m.createdAt)}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {messages.length === 0 && <p className="text-center text-sm text-muted">{t("firstMessage")}</p>}
      </div>

      {listing.status === "removed" ? (
        <p className="border-t border-line bg-white p-4 text-center text-sm text-muted">{t("listingRemoved")}</p>
      ) : (
        <Composer conversationId={conversation.id} locale={locale} />
      )}
    </div>
  );
}
