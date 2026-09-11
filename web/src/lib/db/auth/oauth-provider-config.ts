import { getPlatformSetting, setPlatformSetting } from "../settings";
import { listOAuthAdapters } from "./oauth-registry";
import type { OAuthAdapter, OAuthConfigField } from "./oauth-adapter";

// Generic, Settings-backed config storage any OAuthAdapter can use for its
// per-field config (client id/secret/tenant/etc.) — this is the "reuse the
// Settings pattern" half of the brief. Every value lands as an ordinary
// PlatformSetting row (category "oauth_provider", key
// `oauth_provider.<adapter.id>.<field.key>`), so it gets the exact same
// encryption-at-rest + redaction-in-listings behavior sensitive settings
// already have (settings.ts), with zero new storage mechanism. Google/Apple
// deliberately don't use this — they predate it and stay on env vars
// (oauth-provider.ts), see oauth-adapter.ts's header comment.

const CATEGORY = "oauth_provider";

export function oauthConfigSettingKey(adapterId: string, field: string): string {
  return `${CATEGORY}.${adapterId}.${field}`;
}

export async function getOAuthProviderConfigValue(adapterId: string, field: string): Promise<string | undefined> {
  return getPlatformSetting<string>(oauthConfigSettingKey(adapterId, field));
}

export async function setOAuthProviderConfigValue(params: {
  adapterId: string;
  field: string;
  value: string;
  sensitive: boolean;
}): Promise<void> {
  await setPlatformSetting({
    category: CATEGORY,
    key: oauthConfigSettingKey(params.adapterId, params.field),
    value: params.value,
    isSensitive: params.sensitive,
  });
}

/** The `enabled` flag is a first-class field of its own (not part of `configFields`) — a Super Admin kill switch that doesn't discard already-entered credentials, separate from whether those credentials are actually complete. Defaults to false: a freshly-registered adapter with zero config must never appear "on". */
export async function isOAuthProviderEnabled(adapterId: string): Promise<boolean> {
  return Boolean(await getPlatformSetting<boolean>(oauthConfigSettingKey(adapterId, "enabled")));
}

export async function setOAuthProviderEnabled(adapterId: string, enabled: boolean): Promise<void> {
  await setPlatformSetting({
    category: CATEGORY,
    key: oauthConfigSettingKey(adapterId, "enabled"),
    value: enabled,
    isSensitive: false,
  });
}

/** True once every field the adapter marked `required` has a stored value — ignores optional fields entirely. Does NOT factor in the `enabled` flag (that's a separate, orthogonal check); an adapter's own `isConfigured()` is expected to combine both, same as microsoftEntraIdAdapter does. */
export async function hasRequiredOAuthProviderConfig(adapter: { id: string; configFields: OAuthConfigField[] }): Promise<boolean> {
  const requiredFields = adapter.configFields.filter((f) => f.required);
  const values = await Promise.all(requiredFields.map((f) => getOAuthProviderConfigValue(adapter.id, f.key)));
  return values.every((v) => Boolean(v));
}

export interface OAuthProviderFieldStatus extends OAuthConfigField {
  hasValue: boolean;
  /** The real value for non-sensitive fields (form prefill); always null for sensitive fields — never handed back out once written, same convention listPlatformSettings() already uses. */
  value: string | null;
}

export interface OAuthProviderStatus {
  id: string;
  displayName: string;
  enabled: boolean;
  /** enabled AND every required field present — what the login page/route actually gates on. */
  configured: boolean;
  fields: OAuthProviderFieldStatus[];
}

/**
 * Drives the Super Admin "Auth providers" page: every *registered* adapter
 * (oauth-registry.ts), regardless of configured state, so the UI never
 * hardcodes which providers exist — new adapters show up here automatically
 * the moment their module is registered.
 */
export async function listOAuthProviderStatuses(): Promise<OAuthProviderStatus[]> {
  const adapters = listOAuthAdapters();
  return Promise.all(adapters.map((adapter) => buildStatus(adapter)));
}

async function buildStatus(adapter: OAuthAdapter): Promise<OAuthProviderStatus> {
  const [enabled, fields] = await Promise.all([
    isOAuthProviderEnabled(adapter.id),
    Promise.all(
      adapter.configFields.map(async (field): Promise<OAuthProviderFieldStatus> => {
        const raw = await getOAuthProviderConfigValue(adapter.id, field.key);
        return { ...field, hasValue: Boolean(raw), value: field.sensitive ? null : raw ?? null };
      }),
    ),
  ]);
  const requiredPresent = adapter.configFields.filter((f) => f.required).every((f) => fields.find((s) => s.key === f.key)?.hasValue);
  return {
    id: adapter.id,
    displayName: adapter.displayName,
    enabled,
    configured: enabled && requiredPresent,
    fields,
  };
}
