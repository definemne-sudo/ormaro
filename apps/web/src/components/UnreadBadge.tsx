import { getDb } from "@ormaro/db";
import { getTranslations } from "next-intl/server";
import { unreadCount } from "@/lib/messages";
import { getCurrentUser } from "@/lib/session";

/** Alt menüdeki Mesajlar simgesinin üstündeki okunmamış sayısı. */
export async function UnreadBadge() {
  if (!getDb()) return null;
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  const n = await unreadCount(user.id);
  if (n === 0) return null;
  const t = await getTranslations("nav");
  return (
    <span
      className="absolute -top-1 left-1/2 ml-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-strong px-1 text-[11px] font-bold text-white"
      aria-label={t("unread", { count: n })}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
