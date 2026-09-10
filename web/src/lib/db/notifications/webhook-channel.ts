import { createHmac } from "node:crypto";
import { getNotificationChannelConfigValue, hasRequiredNotificationChannelConfig, isNotificationChannelEnabled } from "./channel-config";
import { registerNotificationChannel } from "./channel-registry";
import type { NotificationChannel, NotificationMessage, NotificationSendResult } from "./channel";

// The "webhook" notification channel (REQUIREMENTS.md §2.14) — the simplest
// channel to make fully real with zero external account dependency (per the
// brief): POSTs a JSON payload to a configured URL with an HMAC-SHA256
// signature header, verifiable by any consumer that knows the shared secret
// — the exact same "signed webhook delivery" shape this codebase already
// uses on the *receiving* end for Stripe/PayPal, just outbound instead of
// inbound. Settings-backed config (channel-config.ts), same as email.

export const ADAPTER_ID = "webhook";
export const WEBHOOK_SIGNATURE_HEADER = "X-Notification-Signature";

const CONFIG_FIELDS = [
  { key: "url", label: "Target URL", sensitive: false, required: true },
  { key: "secret", label: "Signing secret", sensitive: true, required: true },
];

interface WebhookConfig {
  url: string;
  secret: string;
}

async function loadConfig(): Promise<WebhookConfig | null> {
  const enabled = await isNotificationChannelEnabled(ADAPTER_ID);
  if (!enabled) return null;
  const hasRequired = await hasRequiredNotificationChannelConfig({ id: ADAPTER_ID, configFields: CONFIG_FIELDS });
  if (!hasRequired) return null;
  const [url, secret] = await Promise.all([
    getNotificationChannelConfigValue(ADAPTER_ID, "url"),
    getNotificationChannelConfigValue(ADAPTER_ID, "secret"),
  ]);
  if (!url || !secret) return null;
  return { url, secret };
}

function signPayload(secret: string, payload: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export const webhookNotificationChannel: NotificationChannel = {
  id: ADAPTER_ID,
  displayName: "Webhook",
  configFields: CONFIG_FIELDS,
  async isConfigured() {
    return (await loadConfig()) !== null;
  },
  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    const config = await loadConfig();
    if (!config) {
      return { ok: false, skipped: true, error: "Webhook channel is not enabled/configured." };
    }

    const payload = JSON.stringify({
      kind: message.kind,
      organizationId: message.organizationId ?? null,
      userId: message.userId ?? null,
      email: message.email ?? null,
      subject: message.subject,
      body: message.body,
      metadata: message.metadata ?? null,
      sentAt: new Date().toISOString(),
    });
    const signature = signPayload(config.secret, payload);

    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [WEBHOOK_SIGNATURE_HEADER]: signature,
        },
        body: payload,
      });
      if (!response.ok) {
        return { ok: false, error: `Webhook target responded with HTTP ${response.status}.` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Webhook delivery failed." };
    }
  },
};

// Self-registration: importing this module (which packages/db/src/index.ts
// does) is enough to make the webhook channel dispatched to by notify.ts and
// configurable at `/super-admin/settings/notification-channels`.
registerNotificationChannel(webhookNotificationChannel);
