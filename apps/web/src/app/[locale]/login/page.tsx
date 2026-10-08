import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { devLoginEnabled, googleLoginEnabled, signIn } from "@/auth";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

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

/** Yalnızca uygulama içindeki bir yola geri dönülür; dış adreslere yönlendirme yapılmaz. */
function safeNext(next: string | undefined, locale: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return `/${locale}`;
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, error } = await searchParams;
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

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDF0EC] p-3 text-[15px] font-semibold text-[#9A2B12]">
          {t("error")}
        </p>
      )}

      {googleLoginEnabled ? (
        <form action={google}>
          <button
            type="submit"
            className="min-h-13 w-full rounded-xl border-[1.5px] border-field bg-white text-base font-bold text-ink"
          >
            {t("google")}
          </button>
        </form>
      ) : (
        <p className="rounded-xl border border-line p-4 text-[15px] text-muted">{t("notConfigured")}</p>
      )}

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
