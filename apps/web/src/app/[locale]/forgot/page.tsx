import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { forgotAction } from "../login/actions";
import { AuthPage, ErrorBox, Field, Hidden, safeNext, Submit } from "../login/ui";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("forgotTitle") };
}

const known = ["email", "mailUnavailable", "mailFailed", "tooSoon", "tooMany"];

export default async function ForgotPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNext(sp.next, locale);
  const t = await getTranslations("login");

  return (
    <AuthPage title={t("forgotTitle")} subtitle={t("forgotSubtitle")}>
      {sp.error && <ErrorBox>{t(`errors.${known.includes(sp.error) ? sp.error : "generic"}`)}</ErrorBox>}
      <form action={forgotAction} className="flex flex-col gap-4">
        <Hidden locale={locale} next={next} />
        <Field id="email" label={t("email")} type="email" autoComplete="email" required defaultValue={sp.email ?? ""} />
        <Submit>{t("forgotSubmit")}</Submit>
      </form>
      <Link href={{ pathname: "/login", query: { next } }} className="self-center font-semibold text-brand-strong">
        {t("backToLogin")}
      </Link>
    </AuthPage>
  );
}
