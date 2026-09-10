// Branded HTML email templates for the auth emails (verification + password
// reset). Mirrors the design language of the app itself (navy/sunset/mist
// tokens from globals.css, Plus Jakarta Sans from the app font) so every mail a
// user receives looks like it came from the same brand, not a CRM default.
// Branding is dynamic — site name, logo and copyright come from the Super
// Admin's branding / page-content settings, matching what the super admin
// sees, with a "360 NFC Valet" fallback when nothing is configured. Kept plain
// in structure (tables, inline styles) for Gmail / Outlook <…> handling — no
// `<style>` blocks or flexbox, which are unreliable in mail clients.

import { getBrandingSettings, getPageContentSettings } from "../platform-config";
import { BRAND_NAME } from "../../brand";

const THEME = {
  navy: "#1c2b46",
  navyDeep: "#16213a",
  hero: "linear-gradient(135deg,#1c2b46 0%,#2a3c61 100%)",
  accent: "linear-gradient(135deg,#f4531f,#ff8a50)",
  body: "#6c7a93",
  divider: "#e7eaf0",
  muted: "#9aa6bc",
  success: "#0c9d61",
};

const EMAIL_FONT =
  "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const DEFAULT_BRANDING: EmailBranding = {
  siteName: BRAND_NAME,
  logoLightUrl: null,
  copyright: `${BRAND_NAME} \u00A0\u00B7\u00A0 Dubai, UAE`,
};

export interface EmailBranding {
  siteName: string;
  logoLightUrl: string | null;
  copyright: string;
}

/** Default logo mark — the parking-arcs glyph on the sunset gradient (same art as the favicon), embedded so emails stay branded even before a Super Admin uploads a light logo. CID inline attachment for full email-client compatibility (Gmail strips data: URIs). */
function brandMark(logoLightUrl: string | null): string {
  const src = logoLightUrl || "cid:brand-logo";
  return `<img src="${src}" alt="" width="42" height="42" style="display:block;border:0;border-radius:13px;" />`;
}

/**
 * Resolves the branding shown in emails from the Super Admin's settings
 * (Branding + Pages & content) so the mail matches what the super admin
 * configures. Falls back to "360 NFC Valet" defaults when unset.
 */
export async function resolveEmailBranding(): Promise<EmailBranding> {
  const [branding, content] = await Promise.all([getBrandingSettings(), getPageContentSettings()]);
  const siteName = branding.siteName || content.brandName || DEFAULT_BRANDING.siteName;
  return {
    siteName,
    logoLightUrl: branding.logoLightUrl,
    copyright: content.copyright || `${siteName} \u00A0\u00B7\u00A0 Dubai, UAE`,
  };
}

interface TemplateInput {
  branding: EmailBranding;
  name?: string;
  /** Fallback plain-text token when the client can't render HTML (kept visible so the token is still usable from a text mail client). */
  token: string;
  actionUrl: string;
  actionLabel: string;
  headline: string;
  messageHtml: string;
}

export function buildEmailShell(input: TemplateInput): string {
  const name = input.name ? `Hi ${input.name},` : "Hi there,";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${input.headline}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:${EMAIL_FONT};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <tr>
    <td style="padding:32px 32px 24px;background:${THEME.hero};">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="width:42px;">
            ${brandMark(input.branding.logoLightUrl)}
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <span style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-0.3px;">${input.branding.siteName}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:36px 32px 16px;">
      <h2 style="margin:0 0 8px;color:${THEME.navyDeep};font-size:20px;font-weight:800;">${input.headline}</h2>
      <p style="margin:0;color:${THEME.body};font-size:14px;line-height:22px;">${name}</p>
      <div style="margin:16px 0 0;color:${THEME.body};font-size:14px;line-height:22px;">${input.messageHtml}</div>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 32px;">
      <a href="${input.actionUrl}" target="_blank" style="display:block;text-align:center;background:${THEME.accent};color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:16px 24px;border-radius:99px;box-shadow:0 4px 16px rgba(244,83,31,0.3);">
        ${input.actionLabel}
      </a>
      <p style="margin:14px 0 0;color:${THEME.muted};font-size:12px;line-height:18px;text-align:center;word-break:break-all;">
        Or paste: ${input.actionUrl}
      </p>
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
        If you didn't ask for this, you can safely ignore this email.
      </p>
      <p style="margin:12px 0 0;color:${THEME.muted};font-size:11px;line-height:16px;text-align:center;">
        &copy; ${new Date().getFullYear()} ${input.branding.copyright}
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Builds the verification email. `body` (plain text) keeps the raw token for text-only clients and the test suite's token extraction. */
export function buildVerificationEmail(
  opts: { name?: string; token: string; verifyUrl: string },
  branding: EmailBranding = DEFAULT_BRANDING as EmailBranding,
): { subject: string; body: string; html: string } {
  return {
    subject: `Verify your email — ${branding.siteName || "360 NFC Valet"}`,
    body: `Your verification token: ${opts.token}

Or open: ${opts.verifyUrl}`,
    html: buildEmailShell({
      branding,
      name: opts.name,
      token: opts.token,
      actionUrl: opts.verifyUrl,
      actionLabel: "Verify my email",
      headline: "Confirm your email address",
      messageHtml: `
        Welcome to <strong style="color:${THEME.navyDeep};">${branding.siteName}</strong>. One last step — confirm this email address to activate your account. The link expires in <strong style="color:${THEME.navyDeep};">24 hours</strong>.
      `.trim(),
    }),
  };
}

/** Builds the password-reset email. `body` keeps the raw token for text-only clients. */
export function buildPasswordResetEmail(
  opts: { name?: string; token: string; resetUrl: string },
  branding: EmailBranding = DEFAULT_BRANDING as EmailBranding,
): { subject: string; body: string; html: string } {
  return {
    subject: `Reset your password — ${branding.siteName || "360 NFC Valet"}`,
    body: `Your reset token: ${opts.token}

Or open: ${opts.resetUrl}`,
    html: buildEmailShell({
      branding,
      name: opts.name,
      token: opts.token,
      actionUrl: opts.resetUrl,
      actionLabel: "Reset my password",
      headline: "Password Reset Request",
      messageHtml: `
        We received a request to reset the password for your <strong style="color:${THEME.navyDeep};">${branding.siteName}</strong> account. Click the button below to set a new password. This link expires in <strong style="color:${THEME.navyDeep};">1 hour</strong>.
      `.trim(),
    }),
  };
}

/** Resolves the base URL of the app for building verification/reset links. */
export function resolveAppBaseUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}