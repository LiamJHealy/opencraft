// src/lib/mail.ts
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT ?? 587),
  secure: false,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendMail(to: string, subject: string, html: string) {
  if (!EMAIL_FROM) throw new Error("EMAIL_FROM missing");
  if (!SMTP_HOST) {
    // Dev fallback
    console.log("[DEV MAIL] To:", to, "Subj:", subject, "HTML:", html);
    return;
  }
  await transporter.sendMail({ from: EMAIL_FROM, to, subject, html });
}
