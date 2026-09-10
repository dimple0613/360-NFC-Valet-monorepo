import nodemailer from "nodemailer";
import { resolve } from "node:path";
import { BRAND_NAME } from "./brand";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
  });
  return _transporter;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: "smtp_not_configured" };
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME;
  const fromField = fromName ? `"${fromName}" <${from}>` : from;
  const attachments = input.html?.includes("cid:brand-logo")
    ? [{ filename: "brand.png", path: resolve("public/brand.png"), cid: "brand-logo" }]
    : [];
  await transporter.sendMail({ from: fromField, to: input.to, subject: input.subject, html: input.html, attachments });
  return { sent: true };
}

const THEME = {
  navy: "#1C2B46",
  hero: "linear-gradient(135deg,#1C2B46 0%,#2A3F65 100%)",
  accent: "linear-gradient(135deg,#F4531F,#FF8A50)",
  body: "#6C7A93",
  divider: "#E7EAF0",
  muted: "#9AA6BC",
};

export function buildResetEmail({ driverName, resetUrl }: { driverName?: string; resetUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Password Reset Request</title>
</head>
<body style="margin:0;padding:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <tr>
    <td style="padding:32px 32px 24px;background:${THEME.hero};">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="width:42px;">
            <img src="cid:brand-logo" alt="" width="42" height="42" style="display:block;border:0;border-radius:13px;" />
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <span style="color:#FFFFFF;font-size:17px;font-weight:800;letter-spacing:-0.3px;">${BRAND_NAME}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:36px 32px 16px;">
      <h2 style="margin:0 0 8px;color:${THEME.navy};font-size:20px;font-weight:800;">Password Reset Request</h2>
      <p style="margin:0;color:${THEME.body};font-size:14px;line-height:22px;">
        Hi ${driverName || "Driver"},
      </p>
      <p style="margin:12px 0 0;color:${THEME.body};font-size:14px;line-height:22px;">
        We received a request to reset the password for your <strong style="color:${THEME.navy};">${BRAND_NAME}</strong> driver account. Click the button below to set a new password. This link expires in <strong style="color:${THEME.navy};">1 hour</strong>.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 32px;">
      <a href="${resetUrl}" target="_blank" style="display:block;text-align:center;background:${THEME.accent};color:#FFFFFF;font-size:15px;font-weight:800;text-decoration:none;padding:16px 24px;border-radius:99px;box-shadow:0 4px 16px rgba(244,83,31,0.3);">
        Reset My Password
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px;">
      <hr style="border:none;border-top:1px solid ${THEME.divider};margin:0;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 32px;">
      <p style="margin:0;color:${THEME.muted};font-size:12px;line-height:18px;text-align:center;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
      <p style="margin:12px 0 0;color:${THEME.muted};font-size:11px;line-height:16px;text-align:center;">
        &copy; ${new Date().getFullYear()} ${BRAND_NAME} \u00A0\u00B7\u00A0 Dubai, UAE
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}