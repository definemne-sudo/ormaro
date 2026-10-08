"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { sendMessageAction, type ComposerState } from "../actions";

export function Composer({ conversationId, locale }: { conversationId: string; locale: string }) {
  const t = useTranslations("chat");
  const [state, action, pending] = useActionState<ComposerState, FormData>(sendMessageAction, {});
  const [mode, setMode] = useState<"text" | "offer">("text");
  const formRef = useRef<HTMLFormElement>(null);

  // Gönderim başarılı olunca kutuyu temizle, teklif modundan çık.
  useEffect(() => {
    if (state.sent) {
      formRef.current?.reset();
      setMode("text");
    }
  }, [state.sent]);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 border-t border-line bg-white px-3 py-2.5"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="mode" value={mode} />
      {state.error && (
        <p role="alert" className="text-[13px] font-semibold text-[#9A2B12]">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {mode === "offer" ? (
        <div className="flex items-center gap-2">
          <label htmlFor="amount" className="sr-only">
            {t("offerAmount")}
          </label>
          <div className="flex min-w-0 flex-1 items-center rounded-xl border-[1.5px] border-brand-strong px-3">
            <span className="text-muted">€</span>
            <input
              id="amount"
              name="amount"
              inputMode="numeric"
              pattern="[0-9 .]*"
              required
              autoFocus
              placeholder={t("offerAmount")}
              className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setMode("text")}
            className="min-h-12 flex-none rounded-xl border border-field px-3 text-sm font-semibold"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 flex-none rounded-xl bg-brand px-4 font-bold text-ink disabled:opacity-60"
          >
            {t("sendOffer")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("offer")}
            className="min-h-12 flex-none rounded-xl border-[1.5px] border-brand-strong px-3 text-sm font-bold text-brand-strong"
          >
            {t("offer")}
          </button>
          <label htmlFor="body" className="sr-only">
            {t("placeholder")}
          </label>
          <input
            id="body"
            name="body"
            autoComplete="off"
            maxLength={2000}
            placeholder={t("placeholder")}
            className="h-12 min-w-0 flex-1 rounded-xl border border-field px-3.5 text-[15px] focus:border-brand-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            aria-label={t("send")}
            className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand text-ink disabled:opacity-60"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12l16-7-6 16-2.5-6.5z" />
            </svg>
          </button>
        </div>
      )}
    </form>
  );
}
