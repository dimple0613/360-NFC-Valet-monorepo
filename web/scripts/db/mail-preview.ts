import "dotenv/config";
import nodemailer from "nodemailer";
import { resolve } from "node:path";
import { buildVerificationEmail, buildPasswordResetEmail, buildEmailShell, resolveAppBaseUrl, resolveEmailBranding } from "../../src/lib/db/auth/email-templates";
import { buildResetEmail } from "../../src/lib/valet-mail";

const TO = process.env.TEST_MAIL_TO ?? "dimplegohel0613@gmail.com";

async function main() {
  const branding = await resolveEmailBranding();
  const base = resolveAppBaseUrl();
  const sampleToken = "sFT6vU5gyJpIXv9uNKyQ2jwLxAn7C3mR";

  const verification = buildVerificationEmail(
    { name: "Dimple Gohel", token: sampleToken, verifyUrl: `${base}/verify-email?token=${encodeURIComponent(sampleToken)}` },
    branding,
  );
  const reset = buildPasswordResetEmail(
    { name: "Dimple Gohel", token: sampleToken, resetUrl: `${base}/reset-password?token=${encodeURIComponent(sampleToken)}` },
    branding,
  );
  const driverReset = buildResetEmail({
    driverName: "Ahmed Khan",
    resetUrl: `${process.env.RESET_URL || "http://localhost:3001"}/reset-password?token=${encodeURIComponent(sampleToken)}`,
  });
  const invite = {
    subject: `You've been invited to join Dimple PayPal Org`,
    html: buildEmailShell({
      branding,
      token: sampleToken,
      actionUrl: `${base}/invite/accept?token=${encodeURIComponent(sampleToken)}`,
      actionLabel: "Accept invitation",
      headline: "You've been invited",
      messageHtml: `You've been invited to join <strong style="color:#1c2b46;">Dimple PayPal Org</strong> on <strong style="color:#1c2b46;">${branding.siteName}</strong>. This invite expires in <strong style="color:#1c2b46;">7 days</strong>.`,
    }),
  };

  const mails: { label: string; to: string; subject: string; html: string }[] = [
    { label: "VERIFICATION", to: TO, subject: `TEST: ${verification.subject}`, html: verification.html },
    { label: "PASSWORD-RESET", to: TO, subject: `TEST: ${reset.subject}`, html: reset.html },
    { label: "DRIVER-RESET", to: TO, subject: `TEST: Reset your password — 360 NFC Valet`, html: driverReset },
    { label: "ORG-INVITE", to: TO, subject: `TEST: ${invite.subject}`, html: invite.html },
  ];

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP env vars missing");
  const fromRaw = process.env.SMTP_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME;
  const from = fromName ? `"${fromName}" <${fromRaw}>` : fromRaw;
  const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  const brandPngPath = resolve("public/brand.png");
  const attachments = [{ filename: "brand.png", path: brandPngPath, cid: "brand-logo" }];

  for (const m of mails) {
    try {
      const info = await t.sendMail({ from, to: m.to, subject: m.subject, html: m.html, attachments });
      console.log(`[${m.label}] sent messageId=${info.messageId} subject="${m.subject}"`);
    } catch (e) {
      console.error(`[${m.label}] FAILED:`, e instanceof Error ? e.message : e);
    }
  }
  console.log("MAIL-PREVIEW DONE");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });