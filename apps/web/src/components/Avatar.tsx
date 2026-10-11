import { photoSrc } from "@/lib/storage";

/**
 * Profil fotoğrafı; yoksa adın baş harfi.
 * Kayıtlı değer ya Google'dan gelen tam adres ya da depodaki dosya anahtarıdır.
 */
export function Avatar({
  name,
  url,
  size = 40,
  className = "",
}: {
  name: string | null | undefined;
  url: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const src = url ? (/^https:\/\//.test(url) ? url : url.startsWith("avatars/") ? photoSrc(url) : null) : null;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={`flex-none rounded-full bg-brand-tint object-cover ${className}`}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full bg-brand-tint font-bold text-brand-deep ${className}`}
      style={style}
    >
      {(name ?? "?").trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
