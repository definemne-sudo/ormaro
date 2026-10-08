"use client";

import type { ReactNode } from "react";

/** Sıralama değişince formu hemen gönderir; JavaScript kapalıysa "Ara" düğmesi aynı işi görür. */
export function SortSelect({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  return (
    <select
      name="sort"
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="h-11 rounded-lg border border-field bg-white px-2 text-sm"
    >
      {children}
    </select>
  );
}
