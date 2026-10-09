"use server";

import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import {
  findUserByEmail,
  isEmail,
  issueCode,
  latestRegistration,
  normalizeEmail,
  redeemCode,
  type Purpose,
} from "@/lib/emailAuth";
import { canSendMail, sendMail } from "@/lib/mail";
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password";

/** Yalnızca uygulama içindeki bir yola geri dönülür; dış adreslere yönlendirme yapılmaz. */
function safeNext(next: string, locale: string): string {
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return `/${locale}`;
}

function read(formData: FormData) {
  const locale = String(formData.get("locale") ?? "me");
  return {
    locale,
    next: safeNext(String(formData.get("next") ?? ""), locale),
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    code: String(formData.get("code") ?? "").replace(/\D/g, ""),
  };
}

function back(locale: string, page: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`/${locale}/${page}?${q}`);
}

async function mailCode(locale: string, email: string, purpose: Purpose, code: string) {
  const t = await getTranslations({ locale, namespace: "login" });
  await sendMail(
    email,
    t(purpose === "register" ? "mailRegisterSubject" : "mailResetSubject", { code }),
    t(purpose === "register" ? "mailRegisterBody" : "mailResetBody", { code }),
  );
}

/** Kod doğrulandıktan sonra tek kullanımlık biletle oturum açar. */
async function signInWithTicket(locale: string, email: string, ticket: string, next: string) {
  try {
    await signIn("ticket", { email, ticket, redirectTo: next });
  } catch (e) {
    if (e instanceof AuthError) back(locale, "login", { error: "generic", email, next });
    throw e;
  }
}

export async function passwordLoginAction(formData: FormData) {
  const f = read(formData);
  try {
    await signIn("password", { email: f.email, password: f.password, redirectTo: f.next });
  } catch (e) {
    if (e instanceof AuthError) back(f.locale, "login", { error: "credentials", email: f.email, next: f.next });
    throw e;
  }
}

export async function registerAction(formData: FormData) {
  const f = read(formData);
  const keep = { email: f.email, name: f.name, next: f.next };
  if (f.name.length < 2 || f.name.length > 60) back(f.locale, "register", { ...keep, error: "name" });
  if (!isEmail(f.email)) back(f.locale, "register", { ...keep, error: "email" });
  if (f.password.length < PASSWORD_MIN || f.password.length > PASSWORD_MAX) {
    back(f.locale, "register", { ...keep, error: "password" });
  }
  if (!canSendMail()) back(f.locale, "register", { ...keep, error: "mailUnavailable" });
  const passwordHash = await hashPassword(f.password);
  const issued = await issueCode({ email: f.email, purpose: "register", name: f.name, passwordHash });
  if ("error" in issued) back(f.locale, "register", { ...keep, error: issued.error });
  try {
    await mailCode(f.locale, f.email, "register", issued.code);
  } catch (e) {
    console.error("Kayıt kodu gönderilemedi", e);
    back(f.locale, "register", { ...keep, error: "mailFailed" });
  }
  back(f.locale, "verify", { email: f.email, next: f.next });
}

export async function resendRegisterAction(formData: FormData) {
  const f = read(formData);
  const prev = isEmail(f.email) ? await latestRegistration(f.email) : null;
  if (!prev) back(f.locale, "register", { email: f.email, next: f.next });
  const issued = await issueCode({ email: f.email, purpose: "register", ...prev });
  if ("error" in issued) back(f.locale, "verify", { email: f.email, next: f.next, error: issued.error });
  try {
    await mailCode(f.locale, f.email, "register", issued.code);
  } catch (e) {
    console.error("Kayıt kodu gönderilemedi", e);
    back(f.locale, "verify", { email: f.email, next: f.next, error: "mailFailed" });
  }
  back(f.locale, "verify", { email: f.email, next: f.next, sent: "1" });
}

export async function verifyAction(formData: FormData) {
  const f = read(formData);
  const result = await redeemCode({ email: f.email, purpose: "register", code: f.code });
  if ("error" in result) back(f.locale, "verify", { email: f.email, next: f.next, error: result.error });
  await signInWithTicket(f.locale, f.email, result.ticket, f.next);
}

export async function forgotAction(formData: FormData) {
  const f = read(formData);
  if (!isEmail(f.email)) back(f.locale, "forgot", { email: f.email, next: f.next, error: "email" });
  if (!canSendMail()) back(f.locale, "forgot", { email: f.email, next: f.next, error: "mailUnavailable" });
  // Adresin kayıtlı olup olmadığı dışarıya belli edilmez: her durumda kod ekranına geçilir.
  if (await findUserByEmail(f.email)) {
    const issued = await issueCode({ email: f.email, purpose: "reset" });
    if ("error" in issued) back(f.locale, "forgot", { email: f.email, next: f.next, error: issued.error });
    try {
      await mailCode(f.locale, f.email, "reset", issued.code);
    } catch (e) {
      console.error("Sıfırlama kodu gönderilemedi", e);
      back(f.locale, "forgot", { email: f.email, next: f.next, error: "mailFailed" });
    }
  }
  back(f.locale, "reset", { email: f.email, next: f.next });
}

export async function resetAction(formData: FormData) {
  const f = read(formData);
  const keep = { email: f.email, next: f.next };
  if (f.password.length < PASSWORD_MIN || f.password.length > PASSWORD_MAX) {
    back(f.locale, "reset", { ...keep, error: "password" });
  }
  const result = await redeemCode({
    email: f.email,
    purpose: "reset",
    code: f.code,
    newPasswordHash: await hashPassword(f.password),
  });
  if ("error" in result) back(f.locale, "reset", { ...keep, error: result.error });
  await signInWithTicket(f.locale, f.email, result.ticket, f.next);
}
