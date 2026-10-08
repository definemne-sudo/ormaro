import { Suspense, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { BottomNav } from "./BottomNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { UnreadBadge } from "./UnreadBadge";

/** Uygulamanın ortak iskeleti: üstte logo ve dil, altta menü. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col bg-surface pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2">
        <Link href="/" className="flex min-h-11 items-center" aria-label="Ormaro">
          <Logo size={30} />
        </Link>
        <Suspense>
          <LanguageSwitcher />
        </Suspense>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav
        messagesBadge={
          <Suspense>
            <UnreadBadge />
          </Suspense>
        }
      />
    </div>
  );
}
