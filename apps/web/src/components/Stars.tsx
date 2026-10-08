/** Salt okunur yıldız gösterimi; ekran okuyucular için metin karşılığı ayrıca verilir. */
export function Stars({ value, size = 16, label }: { value: number; size?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? "#D97706" : "none"}
          stroke={i <= Math.round(value) ? "#B45309" : "#8A93A3"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
        </svg>
      ))}
    </span>
  );
}
