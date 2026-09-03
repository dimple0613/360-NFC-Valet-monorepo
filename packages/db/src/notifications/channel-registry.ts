import type { NotificationChannel } from "./channel";

// The notification-channel half of CLAUDE.md's "provider adapter pattern"
// requirement — a plain in-process Map keyed by channel id, structurally
// identical to auth/oauth-registry.ts and billing/payment-provider-registry.ts
// (same rationale: which channels *exist* is a code-level concern, a module
// ships its channel and registers it; which of those registered channels is
// actually *enabled/configured* is the data-level concern, handled by
// channel-config.ts against the platform Settings service). Re-registering
// the same id (e.g. a hot-reloaded dev server re-evaluating the channel
// module) is a harmless overwrite, not an error — no de-dup bookkeeping
// needed.

const registry = new Map<string, NotificationChannel>();

export function registerNotificationChannel(channel: NotificationChannel): void {
  registry.set(channel.id, channel);
}

export function getNotificationChannel(id: string): NotificationChannel | undefined {
  return registry.get(id);
}

export function listNotificationChannels(): NotificationChannel[] {
  return Array.from(registry.values());
}

/** Test/maintenance-only escape hatch — mirrors unregisterOAuthAdapter/unregisterPaymentProviderAdapter: needed so registry tests don't leak dummy channels into other test files sharing this module. Not exported from index.ts — internal to this package. */
export function unregisterNotificationChannel(id: string): void {
  registry.delete(id);
}
