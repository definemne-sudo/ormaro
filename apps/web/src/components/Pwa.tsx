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
