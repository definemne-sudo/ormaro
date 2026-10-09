import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { registerAction } from "../login/actions";
import { AuthPage, ErrorBox, Field, Hidden, safeNext, Submit } from "../login/ui";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string; email?: string; name?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("registerTitle") };
}

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNext(sp.next, locale);
  if (await getCurrentUser()) redirect(next);
  const t = await getTranslations("login");

  return (
    <AuthPage title={t("registerTitle")} subtitle={t("registerSubtitle")}>
      {sp.error && <ErrorBox>{t(`errors.${errorKey(sp.error)}`)}</ErrorBox>}
      <form action={registerAction} className="flex flex-col gap-4">
        <Hidden locale={locale} next={next} />
        <Field id="name" label={t("name")} autoComplete="name" required minLength={2} maxLength={60} defaultValue={sp.name ?? ""} />
        <Field id="email" label={t("email")} type="email" autoComplete="email" required defaultValue={sp.email ?? ""} />
        <Field
          id="password"
          label={t("password")}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={200}
          hint={t("passwordHint")}
        />
        <Submit>{t("registerSubmit")}</Submit>
      </form>
      <p className="text-center text-[15px]">
        {t("haveAccount")}{" "}
        <Link href={{ pathname: "/login", query: { next } }} className="font-bold text-brand-strong">
          {t("signIn")}
        </Link>
      </p>
      <p className="text-center text-xs leading-relaxed text-muted">{t("terms")}</p>
    </AuthPage>
  );
}

const known = ["name", "email", "password", "mailUnavailable", "mailFailed", "tooSoon", "tooMany"];
function errorKey(e: string) {
  return known.includes(e) ? e : "generic";
}
