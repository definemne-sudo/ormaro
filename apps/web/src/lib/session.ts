import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/** Giriş yapılmamışsa giriş sayfasına yollar, dönünce aynı sayfaya gelinir. */
export async function requireUser(locale: string, returnTo: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}${returnTo}`)}`);
  }
  return user;
}
