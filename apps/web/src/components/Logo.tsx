/** Ormaro işareti: iki kapılı dolap. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="14" y="10" width="72" height="80" rx="16" fill="#FFAE66" />
      <rect x="48" y="10" width="4" height="80" fill="#131A2A" />
      <circle cx="40" cy="52" r="4.5" fill="#131A2A" />
      <circle cx="60" cy="52" r="4.5" fill="#131A2A" />
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-bold tracking-tight text-ink" style={{ fontSize: size * 0.8 }}>
        ormaro
      </span>
    </span>
  );
}
