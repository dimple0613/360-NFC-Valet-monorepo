// REQUIREMENTS.md §2.14 / CLAUDE.md's provider-adapter rule, applied to
// notification channels: the shared contract new channels implement so
// adding one is "register an adapter" (channel-registry.ts) rather than
// editing dispatch code. Direct structural mirror of
// auth/oauth-adapter.ts / billing/payment-provider.ts — same shape
// (id/displayName/configFields/isConfigured), proving this is the third
// instance of the same pattern, not a new design.
//
// Config storage is intentionally NOT part of this contract, same reasoning
// as the other two adapter contracts: email/webhook use the Settings-backed
// store (channel-config.ts, mirroring oauth-provider-config.ts /
// payment-provider-config.ts); the in-app channel needs no config at all
// (isConfigured() is always true — it only ever writes to this platform's
// own database, nothing external to configure).

/** One piece of per-channel configuration (SMTP host/webhook URL/etc.) a channel needs — declared, not hardcoded, so the Super Admin UI can render a config form for any registered channel without knowing its channel-specific field names ahead of time. Identical shape to OAuthConfigField/PaymentProviderConfigField — kept as its own type so the three adapter contracts stay independently evolvable, matching how this codebase already keeps them textually separate. */
export interface NotificationChannelConfigField {
  /** Stored under `notification_channel.<channel.id>.<key>` via channel-config.ts. */
  key: string;
  label: string;
  /** Encrypted at rest + redacted in listings, same convention as the Settings service (settings.ts). */
  sensitive: boolean;
  required: boolean;
}

/** The rendered notification a channel is asked to deliver — kind/subject/body already resolved from a NotificationKind's template (notify.ts), so a channel never has to know about templates or variable substitution, only how to deliver a subject+body somewhere. */
export interface NotificationMessage {
  /** The NotificationKind key that produced this message (e.g. "org.invite_sent") — carried through for channels that want it in their payload (the webhook channel includes it verbatim) or for logging. */
  kind: string;
  /** FR-102: notifications are tenant-scoped async work — present whenever the triggering event has an organization context. Omitted for pre-tenant events (e.g. email verification at signup, before any org exists) — channels that require it (in-app) simply skip delivery when absent, rather than the caller faking a tenant context that doesn't exist yet. */
  organizationId?: string;
  /** The recipient user, when known — required by the in-app channel (it has nowhere else to write the row) and used to look up a user's email if `email` isn't given explicitly. */
  userId?: string;
  /** Recipient email — required by the email channel. Given explicitly (rather than always resolved from userId) because some notifications target an email address with no User account yet (e.g. an org invite to someone who hasn't signed up). */
  email?: string;
  subject: string;
  body: string;
  /** Arbitrary structured data a channel may want in its payload (the webhook channel includes this verbatim) — never rendered into subject/body itself. */
  metadata?: Record<string, unknown>;
}

export interface NotificationSendResult {
  ok: boolean;
  /** Set when ok is false — a channel is expected to catch its own delivery errors and report them here rather than throwing, so one failing channel never breaks a caller trying every registered channel (notify.ts). */
  error?: string;
  /** Set when a channel didn't attempt delivery at all (e.g. no recipient email given) — distinct from a real delivery failure. */
  skipped?: boolean;
}

/**
 * The contract a new notification channel implements to become usable
 * platform-wide: register one instance with channel-registry.ts and it's
 * immediately dispatched to by notify.ts and configurable at
 * `/super-admin/settings/notification-channels` — no other file needs to
 * change.
 */
export interface NotificationChannel {
  /** URL-safe, stable, used as the Settings key prefix — never rename once deployed. */
  readonly id: string;
  /** Shown on the Super Admin config form/status card. */
  readonly displayName: string;
  readonly configFields: NotificationChannelConfigField[];
  /** True only when every required config field is set AND the channel has been explicitly enabled — mirrors OAuthAdapter/PaymentProvider.isConfigured(). The in-app channel has no config fields and no enable flag — always true. */
  isConfigured(): Promise<boolean>;
  /** Never throws — a delivery failure is reported via `{ ok: false, error }`, so notify.ts can dispatch to every configured channel without one failing channel aborting the others. */
  send(message: NotificationMessage): Promise<NotificationSendResult>;
}
