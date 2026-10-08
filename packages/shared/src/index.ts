import { z } from "zod";

/** Uygulamanın desteklediği diller. URL'de kullanılan kısa kodlar. */
export const locales = ["me", "en", "tr", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "me";

/** <html lang> için BCP 47 etiketleri. Karadağca'nın kodu "cnr". */
export const htmlLang: Record<Locale, string> = {
  me: "cnr",
  en: "en",
  tr: "tr",
  ru: "ru",
};

/** Dil seçicide her dil kendi adıyla görünür. */
export const localeNames: Record<Locale, string> = {
  me: "Crnogorski",
  en: "English",
  tr: "Türkçe",
  ru: "Русский",
};

/** İlk sürüm kategorileri. Adları dil dosyalarında, `categories.<key>` altında. */
export const categoryKeys = [
  "home",
  "electronics",
  "clothing",
  "kids",
  "sports",
  "other",
] as const;
export type CategoryKey = (typeof categoryKeys)[number];

export const conditions = ["new", "like_new", "lightly_used", "good"] as const;
export type Condition = (typeof conditions)[number];

export type Region = "coast" | "central" | "north";

/** Karadağ'ın 25 belediyesi. Rusça arayüzde Kiril yazımı kullanılır. */
export const cities: ReadonlyArray<{
  key: string;
  name: string;
  nameCyrillic: string;
  region: Region;
}> = [
  { key: "andrijevica", name: "Andrijevica", nameCyrillic: "Андриевица", region: "north" },
  { key: "bar", name: "Bar", nameCyrillic: "Бар", region: "coast" },
  { key: "berane", name: "Berane", nameCyrillic: "Беране", region: "north" },
  { key: "bijelo-polje", name: "Bijelo Polje", nameCyrillic: "Бело-Поле", region: "north" },
  { key: "budva", name: "Budva", nameCyrillic: "Будва", region: "coast" },
  { key: "cetinje", name: "Cetinje", nameCyrillic: "Цетине", region: "central" },
  { key: "danilovgrad", name: "Danilovgrad", nameCyrillic: "Даниловград", region: "central" },
  { key: "gusinje", name: "Gusinje", nameCyrillic: "Гусине", region: "north" },
  { key: "herceg-novi", name: "Herceg Novi", nameCyrillic: "Херцег-Нови", region: "coast" },
  { key: "kolasin", name: "Kolašin", nameCyrillic: "Колашин", region: "north" },
  { key: "kotor", name: "Kotor", nameCyrillic: "Котор", region: "coast" },
  { key: "mojkovac", name: "Mojkovac", nameCyrillic: "Мойковац", region: "north" },
  { key: "niksic", name: "Nikšić", nameCyrillic: "Никшич", region: "central" },
  { key: "petnjica", name: "Petnjica", nameCyrillic: "Петница", region: "north" },
  { key: "plav", name: "Plav", nameCyrillic: "Плав", region: "north" },
  { key: "pljevlja", name: "Pljevlja", nameCyrillic: "Плевля", region: "north" },
  { key: "pluzine", name: "Plužine", nameCyrillic: "Плужине", region: "north" },
  { key: "podgorica", name: "Podgorica", nameCyrillic: "Подгорица", region: "central" },
  { key: "rozaje", name: "Rožaje", nameCyrillic: "Рожае", region: "north" },
  { key: "savnik", name: "Šavnik", nameCyrillic: "Шавник", region: "north" },
  { key: "tivat", name: "Tivat", nameCyrillic: "Тиват", region: "coast" },
  { key: "tuzi", name: "Tuzi", nameCyrillic: "Тузи", region: "central" },
  { key: "ulcinj", name: "Ulcinj", nameCyrillic: "Улцинь", region: "coast" },
  { key: "zabljak", name: "Žabljak", nameCyrillic: "Жабляк", region: "north" },
  { key: "zeta", name: "Zeta", nameCyrillic: "Зета", region: "central" },
];

export function cityName(key: string, locale: Locale): string {
  const city = cities.find((c) => c.key === key);
  if (!city) return key;
  return locale === "ru" ? city.nameCyrillic : city.name;
}

/** İlan verirken sunucu ve istemcinin birlikte kullandığı doğrulama kuralları. */
export const listingInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(4000).default(""),
  priceEuro: z.number().int().min(0).max(1_000_000),
  categoryKey: z.enum(categoryKeys),
  condition: z.enum(conditions),
  cityKey: z.string().refine((k) => cities.some((c) => c.key === k)),
  language: z.enum(locales),
});
export type ListingInput = z.infer<typeof listingInput>;

export const MAX_PHOTOS_PER_LISTING = 8;
