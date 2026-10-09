import type { ReactNode } from "react";

export function AuthPage({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 bg-white px-6 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[15px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-[#FDF0EC] p-3 text-[15px] font-semibold text-[#9A2B12]">
      {children}
    </p>
  );
}

export function NoticeBox({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl bg-brand-tint p-3 text-[15px] font-semibold text-brand-deep">
      {children}
    </p>
  );
}

export function Field({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-bold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-12 rounded-xl border border-field px-3.5 text-base focus:border-brand-strong focus:outline-none"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Hidden({ locale, next, email }: { locale: string; next: string; email?: string }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {email !== undefined && <input type="hidden" name="email" value={email} />}
    </>
  );
}

export function Submit({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="min-h-13 w-full rounded-xl bg-brand text-base font-bold text-ink">
      {children}
    </button>
  );
}

export function safeNext(next: string | undefined, locale: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return `/${locale}`;
}
