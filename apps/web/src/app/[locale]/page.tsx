import { categoryKeys, localeNames, type Locale } from "@ormaro/shared";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("categories");

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-4 py-3">
        <Logo size={32} />
        <nav aria-label={t("languageLabel")} className="flex flex-wrap gap-1">
          {routing.locales.map((l) => (
            <Link
              key={l}
              href="/"
              locale={l}
              aria-current={l === locale ? "true" : undefined}
              className={
                "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold " +
                (l === locale
                  ? "bg-brand-tint text-brand-deep"
                  : "text-ink hover:bg-surface")
              }
            >
              <span className="sm:hidden" aria-hidden="true">
                {l.toUpperCase()}
              </span>
              <span className="sr-only sm:not-sr-only">{localeNames[l as Locale]}</span>
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 py-10">
        <section className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{t("tagline")}</h1>
          <p className="text-lg text-muted">{t("comingSoon")}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold">{t("categoriesTitle")}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categoryKeys.map((key) => (
              <li
                key={key}
                className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-white px-2 text-center text-sm font-semibold"
              >
                {tc(key)}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="px-4 py-6 text-sm text-muted">© 2026 Ormaro</footer>
    </div>
  );
}
