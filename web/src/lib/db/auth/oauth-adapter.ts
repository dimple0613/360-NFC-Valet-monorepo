// FR-220/FR-221's provider architecture, generalized: this is the shared
// OAuth2/OIDC adapter contract new providers implement so adding one is
// "register an adapter" (oauth-registry.ts) rather than editing the login
// route, the callback route, or any core auth-flow code.
//
// Google and Apple (oauth-provider.ts) predate this contract and are NOT
// literally wrapped as OAuthAdapter objects here — see TASKS.md for the
// explicit tradeoff writeup. Structurally they're close (beginGoogleAuth/
// completeGoogleAuth mirror beginAuth/completeAuth almost exactly), but two
// real differences made a forced refactor risky for no functional gain:
// Apple's callback is a mandatory `response_mode=form_post` cross-site POST
// (every other provider, including Google and the new Microsoft/Entra ID
// adapter, is a GET redirect with query params) and Apple's client secret is
// a signed JWT recomputed per request rather than a stored config value. The
// contract below is deliberately shaped so a *future* pass could still fold
// Google in (config-driven like Entra, GET-based) without much friction —
// Apple's shape difference is the one that would need the contract itself to
// grow (e.g. an optional `callbackMethod: "GET" | "POST"`), not just a
// mechanical port, so it's left alone.
//
// Config storage is intentionally NOT part of this contract — `isConfigured`
// / `beginAuth` / `completeAuth` are free to read their config from wherever
// makes sense for that adapter. Microsoft/Entra ID (oauth-microsoft-entra-id.ts)
// uses the platform Settings service (oauth-provider-config.ts) per this
// round's brief ("reuse the Settings pattern"); Google/Apple still read env
// vars directly, matching the existing Stripe-adapter-config precedent. A
// real per-org enterprise-SSO story (FR-221's harder case) would need a
// third config source (per-organization) — not attempted here.

export class MissingOAuthConfigError extends Error {
  constructor(provider: string) {
    super(`${provider} sign-in isn't configured on this server.`);
    this.name = "MissingOAuthConfigError";
  }
}

export class OAuthAuthenticationError extends Error {
  constructor(provider: string) {
    super(`${provider} sign-in failed. Please try again.`);
    this.name = "OAuthAuthenticationError";
  }
}

export interface OAuthProfile {
  /** "google" / "apple" for the two hand-written providers, or an OAuthAdapter's own `id` for anything registered via oauth-registry.ts — deliberately a plain string, not a closed union, so resolveOAuthSignIn (oauth-provider.ts) never needs to change when a new provider is added. */
  provider: string;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export interface OAuthAuthorizeResult {
  url: string;
  state: string;
  /** Present for PKCE-using providers (every OAuthAdapter implementation is expected to use PKCE — Apple's hand-written flow is the sole non-PKCE exception, being a confidential client with a JWT secret). */
  codeVerifier?: string;
}

/** One piece of per-provider configuration (client id/secret/tenant/etc.) an adapter needs — declared, not hardcoded, so the Super Admin UI can render a config form for any registered adapter without knowing its provider-specific field names ahead of time. */
export interface OAuthConfigField {
  /** Stored under `oauth_provider.<adapter.id>.<key>` via oauth-provider-config.ts. */
  key: string;
  label: string;
  /** Encrypted at rest + redacted in listings, same convention as the Settings service (settings.ts). */
  sensitive: boolean;
  required: boolean;
}

/**
 * The contract a new OAuth2/OIDC provider implements to become usable
 * platform-wide: register one instance with oauth-registry.ts and it's
 * immediately reachable at `/login/<id>` (web/src/app/(auth)/login/[provider]/route.ts)
 * and configurable at `/super-admin/settings/auth-providers` — no other file
 * needs to change.
 */
export interface OAuthAdapter {
  /** URL-safe, stable, used as the Settings key prefix and the `/login/<id>` route segment — never rename once deployed (existing OAuthAccount rows key off it as `provider`). */
  readonly id: string;
  /** Shown on the login button and the Super Admin config form. */
  readonly displayName: string;
  readonly configFields: OAuthConfigField[];
  /** True only when every required config field is set AND the provider has been explicitly enabled — mirrors Google/Apple's "buttons stay hidden until configured" behavior for the login page, while still giving Super Admin a kill switch that doesn't discard already-entered credentials. */
  isConfigured(): Promise<boolean>;
  beginAuth(redirectUri: string): Promise<OAuthAuthorizeResult>;
  completeAuth(params: { code: string; codeVerifier?: string; redirectUri: string }): Promise<OAuthProfile>;
}
