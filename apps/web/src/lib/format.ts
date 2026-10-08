import type { Locale } from "@ormaro/shared";

/** Intl API'leri için dil etiketi. Karadağca için Intl'in tanıdığı en yakın etiket. */
const intlTags: Record<Locale, string> = {
  me: "sr-Latn-ME",
  en: "en-GB",
  tr: "tr-TR",
  ru: "ru-RU",
};

export function intlLocale(locale: string): string {
  return intlTags[locale as Locale] ?? "en-GB";
}

export function formatPrice(euro: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(euro);
}

/** "2 saat önce", "dün" gibi göreli zaman. */
export function formatRelative(date: Date, locale: string, now = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), "month");
  return rtf.format(Math.round(seconds / (86400 * 365)), "year");
}

export function formatMonthYear(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(
    date,
  );
}
