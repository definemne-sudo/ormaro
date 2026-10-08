import { cityName, type Locale } from "@ormaro/shared";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPrice, formatRelative } from "@/lib/format";
import type { ListingCard } from "@/lib/listings";
import { photoSrc } from "@/lib/storage";
import { ImageIcon } from "./icons";

function Cover({ coverKey, className }: { coverKey: string | null; className: string }) {
  if (!coverKey) {
    return (
      <div className={`flex items-center justify-center bg-placeholder text-muted ${className}`}>
        <ImageIcon width={28} height={28} />
      </div>
    );
  }
  return (
    // Fotoğraflar zaten telefonda küçültülüyor; Next'in görsel işleme kotasını harcamamak için düz <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoSrc(coverKey)} alt="" loading="lazy" className={`object-cover ${className}`} />
  );
}

/** Ana sayfadaki iki sütunlu ızgara. */
export async function ListingGrid({ items }: { items: ListingCard[] }) {
  const locale = (await getLocale()) as Locale;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/listing/${item.id}`}
            className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white"
          >
            <Cover coverKey={item.coverKey} className="aspect-square w-full" />
            <div className="flex flex-col gap-1 px-3 pt-2.5 pb-3">
              <span className="text-[17px] font-bold">{formatPrice(item.priceEuro, locale)}</span>
              <span className="line-clamp-2 text-sm leading-snug">{item.title}</span>
              <span className="text-xs text-muted">
                {cityName(item.cityKey, locale)} · {formatRelative(item.createdAt, locale)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Arama ve profil için tek sütunlu liste. */
export async function ListingList({ items }: { items: ListingCard[] }) {
  const locale = (await getLocale()) as Locale;
  const tc = await getTranslations("conditions");
  const ts = await getTranslations("listing");
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/listing/${item.id}`}
            className="flex gap-3 rounded-2xl border border-line bg-white p-2.5"
          >
            <Cover coverKey={item.coverKey} className="h-26 w-26 flex-none rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
              <span className="text-lg font-bold">{formatPrice(item.priceEuro, locale)}</span>
              <span className="line-clamp-2 text-[15px] leading-snug">{item.title}</span>
              <span className="text-[13px] text-muted">{tc(item.condition)}</span>
              <span className="mt-auto flex items-center gap-2 text-xs text-muted">
                {cityName(item.cityKey, locale)} · {formatRelative(item.createdAt, locale)}
                {item.status !== "active" && (
                  <span className="rounded-full bg-line px-2 py-0.5 font-bold text-ink">
                    {ts(`status.${item.status}`)}
                  </span>
                )}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
