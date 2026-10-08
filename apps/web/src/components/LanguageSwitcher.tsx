"use client";

import { localeNames, locales, type Locale } from "@ormaro/shared";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

/** Dil değiştirirken bulunulan sayfada ve aynı filtrelerde kalınır. */
export function LanguageSwitcher() {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = Object.fromEntries(params.entries());

  return (
    <nav aria-label={t("language")} className="flex gap-0.5">
      {locales.map((l) => (
        <Link
          key={l}
          href={{ pathname, query }}
          locale={l}
          lang={l === "me" ? "cnr" : l}
          aria-label={localeNames[l as Locale]}
          aria-current={l === current ? "true" : undefined}
          className={
            "flex min-h-11 min-w-11 items-center justify-center rounded-lg px-1.5 text-sm font-semibold " +
            (l === current ? "bg-brand-tint text-brand-deep" : "text-ink hover:bg-surface")
          }
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
