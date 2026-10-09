import nodemailer from "nodemailer";

/**
 * E-posta gönderimi SMTP üzerinden. Ücretsiz kurulum: bir Gmail hesabı + uygulama şifresi.
 * SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=adres@gmail.com, SMTP_PASS=uygulama şifresi.
 */
export const mailConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
);

/** Yerelde SMTP yoksa kod sunucu günlüğüne yazılır; canlıda bu yol kapalıdır. */
export const mailConsoleFallback = !mailConfigured && process.env.VERCEL_ENV !== "production";

export function canSendMail(): boolean {
  return mailConfigured || mailConsoleFallback;
}

let transport: nodemailer.Transporter | null = null;

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!mailConfigured) {
    if (mailConsoleFallback) {
      console.log(`[e-posta] ${to} | ${subject}\n${text}`);
      return;
    }
    throw new Error("SMTP ayarlı değil.");
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || `Ormaro <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}
