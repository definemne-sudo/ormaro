"use client";

import { useState } from "react";

/** Yıldızlar aslında radyo düğmeleri: klavyeyle ok tuşlarıyla da seçilebilir. */
export function StarInput({ labels }: { labels: string[] }) {
  const [value, setValue] = useState(0);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-strong">
            <input
              type="radio"
              name="rating"
              value={i}
              required
              className="sr-only"
              onChange={() => setValue(i)}
              aria-label={`${i} / 5 · ${labels[i - 1]}`}
            />
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill={i <= value ? "#D97706" : "none"}
              stroke={i <= value ? "#B45309" : "#8A93A3"}
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
            </svg>
          </label>
        ))}
      </div>
      <p className="min-h-6 text-[15px] font-semibold text-muted" aria-live="polite">
        {value > 0 ? `${value} / 5 · ${labels[value - 1]}` : ""}
      </p>
    </div>
  );
}
