import { MicrosoftEntraId, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { MissingOAuthConfigError, OAuthAuthenticationError, type OAuthAdapter, type OAuthAuthorizeResult, type OAuthConfigField, type OAuthProfile } from "./oauth-adapter";
import { getOAuthProviderConfigValue, hasRequiredOAuthProviderConfig, isOAuthProviderEnabled } from "./oauth-provider-config";
import { registerOAuthAdapter } from "./oauth-registry";

// Real second provider proving the OAuthAdapter contract (oauth-adapter.ts):
// Microsoft/Entra ID, the most commonly requested enterprise-SSO provider
// and a standard OAuth2/OIDC flow — no new protocol needed, unlike SAML/LDAP
// (explicitly deferred, see TASKS.md). Config lives in the platform Settings
// service (oauth-provider-config.ts), NOT env vars — a deliberate departure
// from Google/Apple's pattern, per this round's brief ("reuse the Settings
// pattern"), and a real demonstration of "config-driven, not hardcoded":
// changing/rotating credentials or flipping the kill switch needs zero
// deploys. Arctic (already a dependency for Google/Apple) ships a
// purpose-built MicrosoftEntraId client — same PKCE-based authorization-code
// flow as Google's, just parameterized by tenant.

export const ADAPTER_ID = "microsoft-entra-id";

const CONFIG_FIELDS: OAuthConfigField[] = [
  { key: "tenant_id", label: "Directory (tenant) ID", sensitive: false, required: true },
  { key: "client_id", label: "Application (client) ID", sensitive: false, required: true },
  { key: "client_secret", label: "Client secret", sensitive: true, required: true },
];

interface EntraConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

async function loadConfig(): Promise<EntraConfig> {
  const enabled = await isOAuthProviderEnabled(ADAPTER_ID);
  const hasRequired = await hasRequiredOAuthProviderConfig({ id: ADAPTER_ID, configFields: CONFIG_FIELDS });
  if (!enabled || !hasRequired) throw new MissingOAuthConfigError("Microsoft");

  const [tenantId, clientId, clientSecret] = await Promise.all([
    getOAuthProviderConfigValue(ADAPTER_ID, "tenant_id"),
    getOAuthProviderConfigValue(ADAPTER_ID, "client_id"),
    getOAuthProviderConfigValue(ADAPTER_ID, "client_secret"),
  ]);
  // hasRequiredOAuthProviderConfig already guarantees these are non-empty —
  // re-checked here only so TypeScript narrows away `undefined`.
  if (!tenantId || !clientId || !clientSecret) throw new MissingOAuthConfigError("Microsoft");
  return { tenantId, clientId, clientSecret };
}

function createClient(config: EntraConfig, redirectUri: string): MicrosoftEntraId {
  return new MicrosoftEntraId(config.tenantId, config.clientId, config.clientSecret, redirectUri);
}

interface EntraIdTokenClaims {
  sub: string;
  email?: string;
  /** Entra's v2.0 id_token carries this for work/school and personal accounts when a UPN-style login is used — the fallback identity claim when `email` is absent (some tenant configurations omit it). */
  preferred_username?: string;
  name?: string;
}

/**
 * Pure claims -> OAuthProfile mapping, deliberately split out from
 * completeAuth() so it's testable without a real token/network round-trip
 * (mirrors what Google/Apple's suite couldn't do, since their claims-mapping
 * is inlined into their completeXAuth functions). Unlike Google, Entra's
 * v2.0 id_token has no reliable boolean `email_verified` claim for
 * work/school accounts — an email or UPN present on a token issued by the
 * tenant's own directory is treated as verified, matching how enterprise
 * IdPs are conventionally trusted (the org's own directory vouches for it).
 * Returns null (never throws) when neither claim is present — completeAuth()
 * turns that into the same OAuthAuthenticationError every other rejection
 * path in this adapter produces.
 */
export function mapEntraClaimsToProfile(claims: EntraIdTokenClaims): OAuthProfile | null {
  const email = claims.email ?? claims.preferred_username;
  if (!email) return null;
  return {
    provider: ADAPTER_ID,
    providerUserId: claims.sub,
    email,
    emailVerified: true,
    name: claims.name,
  };
}

export const microsoftEntraIdAdapter: OAuthAdapter = {
  id: ADAPTER_ID,
  displayName: "Microsoft / Entra ID",
  configFields: CONFIG_FIELDS,

  async isConfigured(): Promise<boolean> {
    const [enabled, hasRequired] = await Promise.all([
      isOAuthProviderEnabled(ADAPTER_ID),
      hasRequiredOAuthProviderConfig({ id: ADAPTER_ID, configFields: CONFIG_FIELDS }),
    ]);
    return enabled && hasRequired;
  },

  async beginAuth(redirectUri: string): Promise<OAuthAuthorizeResult> {
    const config = await loadConfig();
    const client = createClient(config, redirectUri);
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = client.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);
    return { url: url.toString(), state, codeVerifier };
  },

  async completeAuth(params: { code: string; codeVerifier?: string; redirectUri: string }): Promise<OAuthProfile> {
    const config = await loadConfig();
    if (!params.codeVerifier) throw new OAuthAuthenticationError("Microsoft");
    const client = createClient(config, params.redirectUri);
    let idToken: string;
    try {
      const tokens = await client.validateAuthorizationCode(params.code, params.codeVerifier);
      idToken = tokens.idToken();
    } catch {
      throw new OAuthAuthenticationError("Microsoft");
    }
    const claims = decodeIdToken(idToken) as EntraIdTokenClaims;
    const profile = mapEntraClaimsToProfile(claims);
    if (!profile) throw new OAuthAuthenticationError("Microsoft");
    return profile;
  },
};

// Self-registration: importing this module (which packages/db/src/index.ts
// does, to re-export the adapter) is enough to make it reachable at
// `/login/microsoft-entra-id` — no login-route or callback-route edits.
registerOAuthAdapter(microsoftEntraIdAdapter);
