import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Avatar } from "@/components/Avatar";
import { Link } from "@/i18n/navigation";
import { blockedUsers } from "@/lib/blocks";
import { requireUser } from "@/lib/session";
import { blockAction } from "../actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "block" });
  return { title: t("listTitle") };
}

export default async function BlockedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/profile/blocked");
  const t = await getTranslations("block");
  const rows = await blockedUsers(user.id);

  return (
    <div className="flex flex-col gap-3 px-4 py-5">
      <h1 className="text-xl font-bold">{t("listTitle")}</h1>
      <p className="text-sm text-muted">{t("listHint")}</p>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-muted">{t("listEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3">
              <Avatar name={u.name} url={u.avatarUrl} size={40} />
              <Link href={`/user/${u.id}`} className="min-w-0 flex-1 truncate font-semibold">
                {u.name ?? t("someone")}
              </Link>
              <form action={blockAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="unblock" value="1" />
                <input type="hidden" name="back" value={`/${locale}/profile/blocked`} />
                <button type="submit" className="min-h-11 rounded-xl border border-field px-3 text-sm font-bold">
                  {t("unblock")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
