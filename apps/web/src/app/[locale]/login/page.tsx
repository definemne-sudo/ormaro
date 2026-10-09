import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { devLoginEnabled, googleLoginEnabled, signIn } from "@/auth";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { passwordLoginAction } from "./actions";
import { ErrorBox, Field, Hidden, safeNext, Submit } from "./ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("title") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, error, email } = await searchParams;
  const redirectTo = safeNext(next, locale);
  if (await getCurrentUser()) redirect(redirectTo);
  const t = await getTranslations("login");

  async function google() {
    "use server";
    await signIn("google", { redirectTo });
  }

  async function dev(formData: FormData) {
    "use server";
    await signIn("dev", { email: String(formData.get("email") ?? ""), redirectTo });
  }

  return (
    <div className="flex flex-col gap-6 bg-white px-6 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold tracking-tight">{t("title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted">{t("subtitle")}</p>
      </div>

      {error && <ErrorBox>{error === "credentials" ? t("errors.credentials") : t("error")}</ErrorBox>}

      {googleLoginEnabled && (
        <>
          <form action={google}>
            <button
              type="submit"
              className="flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-field bg-white text-base font-bold text-ink"
            >
              <GoogleMark />
              {t("google")}
            </button>
          </form>
          <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t("or")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form action={passwordLoginAction} className="flex flex-col gap-4">
        <Hidden locale={locale} next={redirectTo} />
        <Field id="email" label={t("email")} type="email" autoComplete="email" required defaultValue={email ?? ""} />
        <Field id="password" label={t("password")} type="password" autoComplete="current-password" required />
        <Link
          href={{ pathname: "/forgot", query: { next: redirectTo, ...(email ? { email } : {}) } }}
          className="-mt-1 self-end text-sm font-semibold text-brand-strong"
        >
          {t("forgot")}
        </Link>
        <Submit>{t("signIn")}</Submit>
      </form>

      <p className="text-center text-[15px]">
        {t("noAccount")}{" "}
        <Link href={{ pathname: "/register", query: { next: redirectTo } }} className="font-bold text-brand-strong">
          {t("register")}
        </Link>
      </p>

      {devLoginEnabled && (
        <form action={dev} className="flex flex-col gap-2 rounded-xl border border-dashed border-field p-4">
          <label htmlFor="dev-email" className="text-sm font-bold">
            Deneme girişi (yalnızca yerelde)
          </label>
          <input
            id="dev-email"
            name="email"
            type="email"
            required
            className="h-12 rounded-xl border border-field px-3.5"
          />
          <button type="submit" className="min-h-12 rounded-xl bg-ink font-bold text-white">
            Giriş
          </button>
        </form>
      )}

      <div className="flex flex-col items-center gap-3">
        <Link href="/" className="flex min-h-11 items-center font-semibold text-brand-strong">
          {t("continueWithout")}
        </Link>
        <p className="text-center text-xs leading-relaxed text-muted">{t("terms")}</p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
