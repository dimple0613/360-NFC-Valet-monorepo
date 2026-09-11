import { getPlatformSetting, setPlatformSetting } from "../settings";
import { listPaymentProviderAdapters } from "./payment-provider-registry";
import type { PaymentProvider, PaymentProviderConfigField } from "./payment-provider";

// Generic, Settings-backed config storage any PaymentProvider adapter can use
// for its per-field config (API key/secret/environment/webhook id/etc.) —
// this is the "reuse the Settings pattern" half of the brief, and a direct
// structural mirror of auth/oauth-provider-config.ts. Every value lands as
// an ordinary PlatformSetting row (category "payment_provider", key
// `payment_provider.<adapter.id>.<field.key>`), so it gets the exact same
// encryption-at-rest + redaction-in-listings behavior sensitive settings
// already have (settings.ts), with zero new storage mechanism. Stripe
// deliberately doesn't use this — it predates it and stays on env vars
// (stripe-provider.ts), see payment-provider.ts's header comment.

const CATEGORY = "payment_provider";

export function paymentProviderConfigSettingKey(adapterId: string, field: string): string {
  return `${CATEGORY}.${adapterId}.${field}`;
}

export async function getPaymentProviderConfigValue(adapterId: string, field: string): Promise<string | undefined> {
  return getPlatformSetting<string>(paymentProviderConfigSettingKey(adapterId, field));
}

export async function setPaymentProviderConfigValue(params: {
  adapterId: string;
  field: string;
  value: string;
  sensitive: boolean;
}): Promise<void> {
  await setPlatformSetting({
    category: CATEGORY,
    key: paymentProviderConfigSettingKey(params.adapterId, params.field),
    value: params.value,
    isSensitive: params.sensitive,
  });
}

/** The `enabled` flag is a first-class field of its own (not part of `configFields`) — a Super Admin kill switch that doesn't discard already-entered credentials, separate from whether those credentials are actually complete. Defaults to false: a freshly-registered adapter with zero config must never appear "on". */
export async function isPaymentProviderEnabled(adapterId: string): Promise<boolean> {
  return Boolean(await getPlatformSetting<boolean>(paymentProviderConfigSettingKey(adapterId, "enabled")));
}

export async function setPaymentProviderEnabled(adapterId: string, enabled: boolean): Promise<void> {
  await setPlatformSetting({
    category: CATEGORY,
    key: paymentProviderConfigSettingKey(adapterId, "enabled"),
    value: enabled,
    isSensitive: false,
  });
}

/** True once every field the adapter marked `required` has a stored value — ignores optional fields entirely. Does NOT factor in the `enabled` flag (that's a separate, orthogonal check); an adapter's own `isConfigured()` is expected to combine both, same as paypalProvider does. */
export async function hasRequiredPaymentProviderConfig(adapter: {
  id: string;
  configFields: PaymentProviderConfigField[];
}): Promise<boolean> {
  const requiredFields = adapter.configFields.filter((f) => f.required);
  const values = await Promise.all(requiredFields.map((f) => getPaymentProviderConfigValue(adapter.id, f.key)));
  return values.every((v) => Boolean(v));
}

export interface PaymentProviderFieldStatus extends PaymentProviderConfigField {
  hasValue: boolean;
  /** The real value for non-sensitive fields (form prefill); always null for sensitive fields — never handed back out once written, same convention listPlatformSettings() already uses. */
  value: string | null;
}

export interface PaymentProviderStatus {
  id: string;
  displayName: string;
  enabled: boolean;
  /** enabled AND every required field present — what checkout/webhook handling actually gates on for Settings-driven adapters. */
  configured: boolean;
  fields: PaymentProviderFieldStatus[];
}

/**
 * Drives the Super Admin "Payment providers" page: every *registered*
 * adapter (payment-provider-registry.ts), regardless of configured state, so
 * the UI never hardcodes which providers exist — new adapters show up here
 * automatically the moment their module is registered. Stripe is env-var
 * configured and not registered, so it never appears here — same as
 * Google/Apple on the auth-providers page.
 */
export async function listPaymentProviderStatuses(): Promise<PaymentProviderStatus[]> {
  const adapters = listPaymentProviderAdapters();
  return Promise.all(adapters.map((adapter) => buildStatus(adapter)));
}

async function buildStatus(adapter: PaymentProvider): Promise<PaymentProviderStatus> {
  const [enabled, fields] = await Promise.all([
    isPaymentProviderEnabled(adapter.id),
    Promise.all(
      adapter.configFields.map(async (field): Promise<PaymentProviderFieldStatus> => {
        const raw = await getPaymentProviderConfigValue(adapter.id, field.key);
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
