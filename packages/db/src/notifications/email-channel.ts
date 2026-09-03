import nodemailer from "nodemailer";
import { consoleEmailSender, type EmailSender } from "../auth/email-sender";
import { getNotificationChannelConfigValue, hasRequiredNotificationChannelConfig, isNotificationChannelEnabled } from "./channel-config";
import { registerNotificationChannel } from "./channel-registry";
import type { NotificationChannel, NotificationMessage, NotificationSendResult } from "./channel";

// The "email" notification channel (REQUIREMENTS.md §2.14) — a real,
// genuinely-wired SMTP adapter (nodemailer, the standard Node SMTP client;
// confirmed via package.json that no mail library existed anywhere in this
// repo before this round, so this is a new dependency, not a duplicate),
// not a stub that just logs. Settings-backed config (channel-config.ts),
// same pattern as email/webhook OAuth/payment adapters use for their own
// credentials.
//
// This absorbs the pre-existing ad-hoc mailer (auth/email-sender.ts's
// consoleEmailSender, used by local-provider.ts for verification/reset
// emails and organization-invites.ts for invite emails) rather than leaving
// two parallel email-sending code paths: resolveEmailSender() below returns
// a real EmailSender backed by this channel once it's configured, falling
// back to the console placeholder otherwise — the exact same EmailSender
// interface those call sites already depend on, so swapping which one they
// get needs no call-site signature change (see web/'s signup-flow.ts and
// forgot-password/actions.ts, updated to call this instead of always
// defaulting to consoleEmailSender).

export const ADAPTER_ID = "email";

const CONFIG_FIELDS = [
  { key: "smtp_host", label: "SMTP host", sensitive: false, required: true },
  { key: "smtp_port", label: "SMTP port", sensitive: false, required: true },
  { key: "smtp_user", label: "SMTP username", sensitive: false, required: false },
  { key: "smtp_password", label: "SMTP password", sensitive: true, required: false },
  { key: "from_email", label: "From address", sensitive: false, required: true },
  { key: "from_name", label: "From name", sensitive: false, required: false },
];

interface EmailConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
}

interface MailTransport {
  sendMail(options: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

export interface EmailChannelOptions {
  /** Injectable for tests, same pattern as stripe-provider.ts's options.client / paypal-client.ts's fetchImpl — defaults to real nodemailer.createTransport, never exercised by the test suite. */
  transportFactory?: (config: { host: string; port: number; secure: boolean; auth?: { user: string; pass: string } }) => MailTransport;
}

async function loadConfig(): Promise<EmailConfig | null> {
  const enabled = await isNotificationChannelEnabled(ADAPTER_ID);
  if (!enabled) return null;
  const hasRequired = await hasRequiredNotificationChannelConfig({ id: ADAPTER_ID, configFields: CONFIG_FIELDS });
  if (!hasRequired) return null;

  const [host, port, user, password, fromEmail, fromName] = await Promise.all([
    getNotificationChannelConfigValue(ADAPTER_ID, "smtp_host"),
    getNotificationChannelConfigValue(ADAPTER_ID, "smtp_port"),
    getNotificationChannelConfigValue(ADAPTER_ID, "smtp_user"),
    getNotificationChannelConfigValue(ADAPTER_ID, "smtp_password"),
    getNotificationChannelConfigValue(ADAPTER_ID, "from_email"),
    getNotificationChannelConfigValue(ADAPTER_ID, "from_name"),
  ]);
  if (!host || !port || !fromEmail) return null;

  return { host, port: Number(port), user, password, fromEmail, fromName };
}

export function createEmailChannel(options: EmailChannelOptions = {}): NotificationChannel {
  const transportFactory = options.transportFactory ?? ((config) => nodemailer.createTransport(config));

  return {
    id: ADAPTER_ID,
    displayName: "Email (SMTP)",
    configFields: CONFIG_FIELDS,
    async isConfigured() {
      return (await loadConfig()) !== null;
    },
    async send(message: NotificationMessage): Promise<NotificationSendResult> {
      const config = await loadConfig();
      if (!config) {
        return { ok: false, skipped: true, error: "Email channel is not enabled/configured." };
      }
      if (!message.email) {
        return { ok: false, skipped: true, error: "No recipient email address given." };
      }

      const transport = transportFactory({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: config.user ? { user: config.user, pass: config.password ?? "" } : undefined,
      });

      const from = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;

      try {
        await transport.sendMail({ from, to: message.email, subject: message.subject, text: message.body });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Email delivery failed." };
      }
    },
  };
}

// The production instance — self-registers on import (which
// packages/db/src/index.ts does), same convention as every other
// self-registering adapter in this package.
export const emailNotificationChannel: NotificationChannel = createEmailChannel();
registerNotificationChannel(emailNotificationChannel);

/**
 * Bridges the notification-channel framework back into the pre-existing
 * EmailSender interface (auth/email-sender.ts) that local-provider.ts and
 * organization-invites.ts already depend on for verification/reset/invite
 * emails — real SMTP delivery once the email channel is configured,
 * `consoleEmailSender` otherwise (identical behavior to before this round
 * when unconfigured, so nothing regresses in a dev environment with no SMTP
 * credentials). `channel` is injectable for tests; real callers use the
 * default (the real registered singleton above).
 */
export async function resolveEmailSender(channel: NotificationChannel = emailNotificationChannel): Promise<EmailSender> {
  if (!(await channel.isConfigured())) return consoleEmailSender;
  return {
    async send(params: { to: string; subject: string; body: string }) {
      const result = await channel.send({ kind: "raw", email: params.to, subject: params.subject, body: params.body });
      if (!result.ok) throw new Error(result.error ?? "Email delivery failed.");
    },
  };
}
