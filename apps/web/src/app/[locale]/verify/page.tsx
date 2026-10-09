import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { resendRegisterAction, verifyAction } from "../login/actions";
import { AuthPage, ErrorBox, Field, Hidden, NoticeBox, safeNext, Submit } from "../login/ui";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string; email?: string; sent?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("verifyTitle") };
}

const known = ["invalid", "expired", "tooManyAttempts", "tooSoon", "tooMany", "mailFailed"];

export default async function VerifyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNext(sp.next, locale);
  if (await getCurrentUser()) redirect(next);
  const email = sp.email ?? "";
  if (!email) redirect(`/${locale}/register`);
  const t = await getTranslations("login");

  return (
    <AuthPage title={t("verifyTitle")} subtitle={t("verifySubtitle", { email })}>
      {sp.error && <ErrorBox>{t(`errors.${known.includes(sp.error) ? sp.error : "generic"}`)}</ErrorBox>}
      {sp.sent && !sp.error && <NoticeBox>{t("codeResent")}</NoticeBox>}
      <form action={verifyAction} className="flex flex-col gap-4">
        <Hidden locale={locale} next={next} email={email} />
        <Field
          id="code"
          label={t("code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          hint={t("codeHint")}
        />
        <Submit>{t("verifySubmit")}</Submit>
      </form>
      <form action={resendRegisterAction} className="flex flex-col items-center gap-2">
        <Hidden locale={locale} next={next} email={email} />
        <button type="submit" className="min-h-11 text-[15px] font-semibold text-brand-strong">
          {t("resend")}
        </button>
        <Link href={{ pathname: "/register", query: { next, email } }} className="min-h-11 text-sm text-muted underline">
          {t("wrongEmail")}
        </Link>
      </form>
    </AuthPage>
  );
}
