import { getPlatformSetting, setPlatformSetting } from "../settings";
import { listNotificationChannels } from "./channel-registry";
import type { NotificationChannel, NotificationChannelConfigField } from "./channel";

// Generic, Settings-backed config storage any NotificationChannel can use for
// its per-field config (SMTP host/webhook URL/etc.) — direct structural
// mirror of auth/oauth-provider-config.ts and
// billing/payment-provider-config.ts. Every value lands as an ordinary
// PlatformSetting row (category "notification_channel", key
// `notification_channel.<channel.id>.<field.key>`), so it gets the exact
// same encryption-at-rest + redaction-in-listings behavior sensitive
// settings already have (settings.ts), with zero new storage mechanism.

const CATEGORY = "notification_channel";

export function notificationChannelConfigSettingKey(channelId: string, field: string): string {
  return `${CATEGORY}.${channelId}.${field}`;
}

export async function getNotificationChannelConfigValue(channelId: string, field: string): Promise<string | undefined> {
  return getPlatformSetting<string>(notificationChannelConfigSettingKey(channelId, field));
}

export async function setNotificationChannelConfigValue(params: {
  channelId: string;
  field: string;
  value: string;
  sensitive: boolean;
}): Promise<void> {
  await setPlatformSetting({
    category: CATEGORY,
    key: notificationChannelConfigSettingKey(params.channelId, params.field),
    value: params.value,
    isSensitive: params.sensitive,
  });
}

/** The `enabled` flag is a first-class field of its own (not part of `configFields`) — a Super Admin kill switch that doesn't discard already-entered credentials, separate from whether those credentials are actually complete. Defaults to false: a freshly-registered channel with zero config must never appear "on". */
export async function isNotificationChannelEnabled(channelId: string): Promise<boolean> {
  return Boolean(await getPlatformSetting<boolean>(notificationChannelConfigSettingKey(channelId, "enabled")));
}

export async function setNotificationChannelEnabled(channelId: string, enabled: boolean): Promise<void> {
  await setPlatformSetting({
    category: CATEGORY,
    key: notificationChannelConfigSettingKey(channelId, "enabled"),
    value: enabled,
    isSensitive: false,
  });
}

/** True once every field the channel marked `required` has a stored value — ignores optional fields entirely. Does NOT factor in the `enabled` flag (that's a separate, orthogonal check); a channel's own `isConfigured()` is expected to combine both, same as the email/webhook channels do. */
export async function hasRequiredNotificationChannelConfig(channel: {
  id: string;
  configFields: NotificationChannelConfigField[];
}): Promise<boolean> {
  const requiredFields = channel.configFields.filter((f) => f.required);
  const values = await Promise.all(requiredFields.map((f) => getNotificationChannelConfigValue(channel.id, f.key)));
  return values.every((v) => Boolean(v));
}

export interface NotificationChannelFieldStatus extends NotificationChannelConfigField {
  hasValue: boolean;
  /** The real value for non-sensitive fields (form prefill); always null for sensitive fields — never handed back out once written, same convention listPlatformSettings() already uses. */
  value: string | null;
}

export interface NotificationChannelStatus {
  id: string;
  displayName: string;
  enabled: boolean;
  /** enabled AND every required field present — what notify.ts actually gates dispatch on for Settings-driven channels. */
  configured: boolean;
  fields: NotificationChannelFieldStatus[];
}

/**
 * Drives the Super Admin "Notification channels" page: every *registered*
 * channel (channel-registry.ts), regardless of configured state, so the UI
 * never hardcodes which channels exist — new channels show up here
 * automatically the moment their module is registered.
 */
export async function listNotificationChannelStatuses(): Promise<NotificationChannelStatus[]> {
  const channels = listNotificationChannels();
  return Promise.all(channels.map((channel) => buildStatus(channel)));
}

async function buildStatus(channel: NotificationChannel): Promise<NotificationChannelStatus> {
  const [enabled, fields] = await Promise.all([
    isNotificationChannelEnabled(channel.id),
    Promise.all(
      channel.configFields.map(async (field): Promise<NotificationChannelFieldStatus> => {
        const raw = await getNotificationChannelConfigValue(channel.id, field.key);
        return { ...field, hasValue: Boolean(raw), value: field.sensitive ? null : raw ?? null };
      }),
    ),
  ]);
  const requiredPresent = channel.configFields.filter((f) => f.required).every((f) => fields.find((s) => s.key === f.key)?.hasValue);
  return {
    id: channel.id,
    displayName: channel.displayName,
    enabled,
    configured: enabled && requiredPresent,
    fields,
  };
}
