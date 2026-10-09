import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { resetAction } from "../login/actions";
import { AuthPage, ErrorBox, Field, Hidden, safeNext, Submit } from "../login/ui";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("resetTitle") };
}

const known = ["invalid", "expired", "tooManyAttempts", "password"];

export default async function ResetPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNext(sp.next, locale);
  const email = sp.email ?? "";
  if (!email) redirect(`/${locale}/forgot`);
  const t = await getTranslations("login");

  return (
    <AuthPage title={t("resetTitle")} subtitle={t("resetSubtitle", { email })}>
      {sp.error && <ErrorBox>{t(`errors.${known.includes(sp.error) ? sp.error : "generic"}`)}</ErrorBox>}
      <form action={resetAction} className="flex flex-col gap-4">
        <Hidden locale={locale} next={next} email={email} />
        <Field
          id="code"
          label={t("code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
        />
        <Field
          id="password"
          label={t("newPassword")}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={200}
          hint={t("passwordHint")}
        />
        <Submit>{t("resetSubmit")}</Submit>
      </form>
      <Link href={{ pathname: "/forgot", query: { next, email } }} className="self-center text-sm text-muted underline">
        {t("resendReset")}
      </Link>
    </AuthPage>
  );
}
