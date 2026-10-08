"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Sayfa açık ve görünürken belirli aralıklarla sunucudan yeni veriyi çeker.
 * Ücretsiz katmanda sürekli açık bağlantı tutulamadığı için mesajlar bu yolla gelir.
 */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
