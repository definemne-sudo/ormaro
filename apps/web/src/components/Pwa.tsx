"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Tarayıcı kurulum önerisini sayfa açılır açılmaz verir; daha sonra kullanmak için saklanır.
let deferredPrompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Service worker kaydı ve kurulum önerisinin yakalanması; düzende bir kez çalışır. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as InstallPrompt;
      emit();
    };
    const onInstalled = () => {
      deferredPrompt = null;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

function useInstallPrompt() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferredPrompt,
    () => null,
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyToBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState = "loading" | "unsupported" | "needsInstall" | "denied" | "off" | "on" | "error";

function usePush() {
  const locale = useLocale();
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        // iPhone'da bildirimler yalnızca ana ekrana eklenmiş uygulamada çalışır.
        setState(isIos() && !isStandalone() ? "needsInstall" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      if (sub && Notification.permission === "granted") {
        // Dil değişmiş olabilir; kayıt sunucuda güncel tutulur.
        fetch("/api/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...sub.toJSON(), locale }),
        }).catch(() => {});
        setState("on");
      } else setState("off");
    })().catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const enable = useCallback(async () => {
    try {
      setState("loading");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const res = await fetch("/api/push");
      if (!res.ok) return setState("error");
      const { publicKey } = (await res.json()) as { publicKey: string };
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
      const saved = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), locale }),
      });
      setState(saved.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }, [locale]);

  const disable = useCallback(async () => {
    try {
      setState("loading");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("error");
    }
  }, []);

  return { state, enable, disable };
}

const btn = "min-h-12 rounded-xl px-4 font-bold";

/** Profil sayfasındaki "Uygulama" bölümü: telefona kurma ve bildirim ayarı. */
export function AppSettings() {
  const t = useTranslations("app");
  const prompt = useInstallPrompt();
  const [env, setEnv] = useState<{ standalone: boolean; ios: boolean } | null>(null);
  const push = usePush();

  useEffect(() => {
    setEnv({ standalone: isStandalone(), ios: isIos() });
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    emit();
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4" aria-labelledby="app-settings">
      <h2 id="app-settings" className="text-base font-bold">
        {t("title")}
      </h2>

      {env && !env.standalone && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] font-semibold">{t("installTitle")}</p>
          {prompt ? (
            <>
              <p className="text-sm text-muted">{t("installBody")}</p>
              <button type="button" onClick={install} className={`${btn} bg-brand text-ink`}>
                {t("install")}
              </button>
            </>
          ) : env.ios ? (
            <p className="text-sm leading-relaxed text-muted">{t("installIos")}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted">{t("installOther")}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
        <p className="text-[15px] font-semibold">{t("notificationsTitle")}</p>
        <p className="text-sm text-muted" role="status">
          {t(`push.${push.state}`)}
        </p>
        {push.state === "off" || push.state === "error" ? (
          <button type="button" onClick={push.enable} className={`${btn} bg-brand text-ink`}>
            {t("enable")}
          </button>
        ) : push.state === "on" ? (
          <button type="button" onClick={push.disable} className={`${btn} border border-field bg-white text-ink`}>
            {t("disable")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Sohbet ekranında, bildirimler kapalıysa gösterilen küçük öneri. */
export function PushNudge() {
  const t = useTranslations("app");
  const push = usePush();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem("ormaro-push-nudge") === "no");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || push.state !== "off") return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-3">
      <p className="flex-1 text-sm">{t("nudge")}</p>
      <button type="button" onClick={push.enable} className="min-h-11 rounded-xl bg-brand px-3 text-sm font-bold text-ink">
        {t("enableShort")}
      </button>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem("ormaro-push-nudge", "no");
          } catch {}
        }}
        className="flex h-11 w-9 items-center justify-center text-lg text-muted"
      >
        ×
      </button>
    </div>
  );
}

const BANNER_KEY = "ormaro-install-dismissed";
const BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sayfaya girildiğinde alttan çıkan "Uygulamayı yükle" önerisi.
 * Yalnızca telefonda, uygulama henüz kurulu değilse ve kurulum mümkünse gösterilir.
 * Kapatılırsa bir hafta boyunca tekrar çıkmaz.
 */
export function InstallBanner() {
  const t = useTranslations("app");
  const prompt = useInstallPrompt();
  const [mode, setMode] = useState<"hidden" | "ios" | "prompt">("hidden");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    try {
      const at = Number(localStorage.getItem(BANNER_KEY) ?? 0);
      if (at && Date.now() - at < BANNER_SNOOZE_MS) return;
    } catch {}
    // Sayfa açılır açılmaz değil, kullanıcı ekranı gördükten kısa süre sonra çıkar.
    const timer = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (prompt) setMode("prompt");
    else if (isIos()) setMode("ios");
  }, [ready, prompt]);

  function dismiss() {
    setMode("hidden");
    setReady(false);
    try {
      localStorage.setItem(BANNER_KEY, String(Date.now()));
    } catch {}
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    emit();
    if (choice?.outcome !== "accepted") dismiss();
    else setMode("hidden");
  }

  if (mode === "hidden") return null;
  return (
    <div
      role="dialog"
      aria-labelledby="install-banner-title"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-[0_8px_30px_rgba(19,26,42,0.18)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 flex-none rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p id="install-banner-title" className="text-[15px] font-bold">
            {t("bannerTitle")}
          </p>
          {mode === "prompt" ? (
            <>
              <p className="text-sm text-muted">{t("bannerBody")}</p>
              <div className="mt-1.5 flex gap-2">
                <button type="button" onClick={install} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-ink">
                  {t("bannerInstall")}
                </button>
                <button type="button" onClick={dismiss} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted">
                  {t("bannerLater")}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              {t.rich("bannerIos", {
                share: () => (
                  <svg
                    className="mx-0.5 inline-block align-[-3px] text-[#0A84FF]"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    role="img"
                    aria-label={t("shareIcon")}
                  >
                    <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
                  </svg>
                ),
                b: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="-mt-1 -mr-1 flex h-11 w-11 flex-none items-center justify-center text-xl text-muted"
        >
          ×
        </button>
      </div>
    </div>
  );
}
