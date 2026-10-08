"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { ChatIcon, HomeIcon, PlusIcon, SearchIcon, UserIcon } from "./icons";

type Item = { href: string; label: string; icon: ReactNode; primary?: boolean };

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/", label: t("home"), icon: <HomeIcon /> },
    { href: "/search", label: t("search"), icon: <SearchIcon /> },
    { href: "/sell", label: t("sell"), icon: <PlusIcon width={20} height={20} />, primary: true },
    { href: "/messages", label: t("messages"), icon: <ChatIcon /> },
    { href: "/profile", label: t("profile"), icon: <UserIcon /> },
  ];

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-3xl px-2 pt-1.5 pb-2">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex min-h-13 flex-col items-center justify-center gap-1 text-[11px] " +
                  (active ? "font-bold text-brand-strong" : "font-semibold text-muted")
                }
              >
                {item.primary ? (
                  <span className="flex h-7 w-10 items-center justify-center rounded-[10px] bg-brand text-ink">
                    {item.icon}
                  </span>
                ) : (
                  item.icon
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
