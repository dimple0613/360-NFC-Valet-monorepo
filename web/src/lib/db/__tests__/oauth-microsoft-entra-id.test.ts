import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { MissingOAuthConfigError, OAuthAuthenticationError } from "../auth/oauth-adapter";
import { getOAuthAdapter, listOAuthAdapters } from "../auth/oauth-registry";
import { isOAuthProviderEnabled, listOAuthProviderStatuses, setOAuthProviderConfigValue, setOAuthProviderEnabled } from "../auth/oauth-provider-config";
// Importing the adapter module (for its named export + the mapEntraClaimsToProfile
// pure helper) also runs its self-registration side effect, same as any
// consumer importing it via packages/db's index.ts would get for free.
import { ADAPTER_ID, mapEntraClaimsToProfile, microsoftEntraIdAdapter } from "../auth/oauth-microsoft-entra-id";

// This adapter is the concrete proof of the OAuthAdapter contract
// (oauth-adapter.ts) — a genuine second, config-driven OAuth2/OIDC provider
// added without touching the login route, callback route, or
// resolveOAuthSignIn at all. As with the existing Google/Apple suite
// (oauth-provider.test.ts), what's actually network-reachable (a real
// authorization-code exchange against login.microsoftonline.com) isn't
// exercised here — no real Entra app registration credentials exist in this
// environment (see TASKS.md). What IS verified, all offline: self-registration
// into the shared registry, the Settings-driven configured/enabled gating,
// correct authorize-URL construction (tenant/client_id/redirect_uri/scope/
// state/PKCE challenge — the actual OAuth2/OIDC wire contract), and the
// claims->OAuthProfile normalization Microsoft's id_token would produce.

const runId = Date.now().toString(36);

async function clearConfig(): Promise<void> {
  await prismaWithoutTenantScoping.platformSetting.deleteMany({
    where: { key: { startsWith: `oauth_provider.${ADAPTER_ID}.` } },
  });
}

describe("microsoftEntraIdAdapter", () => {
  beforeEach(async () => {
    await clearConfig();
  });

  afterAll(async () => {
    await clearConfig();
  });

  it("self-registers into the shared oauth-registry under its id", () => {
    expect(getOAuthAdapter(ADAPTER_ID)).toBe(microsoftEntraIdAdapter);
    expect(listOAuthAdapters().some((a) => a.id === ADAPTER_ID)).toBe(true);
  });

  it("declares exactly the config fields the Super Admin UI needs to render a form for it, no more", () => {
    const keys = microsoftEntraIdAdapter.configFields.map((f) => f.key).sort();
    expect(keys).toEqual(["client_id", "client_secret", "tenant_id"]);
    expect(microsoftEntraIdAdapter.configFields.find((f) => f.key === "client_secret")!.sensitive).toBe(true);
    expect(microsoftEntraIdAdapter.configFields.every((f) => f.required)).toBe(true);
  });

  it("isConfigured() is false with no config at all", async () => {
    await expect(microsoftEntraIdAdapter.isConfigured()).resolves.toBe(false);
  });

  it("isConfigured() is false with all fields set but not enabled", async () => {
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "tenant_id", value: "tenant-123", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: "client-123", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_secret", value: "secret-123", sensitive: true });
    await expect(isOAuthProviderEnabled(ADAPTER_ID)).resolves.toBe(false);
    await expect(microsoftEntraIdAdapter.isConfigured()).resolves.toBe(false);
  });

  it("isConfigured() is false when enabled but a required field is missing", async () => {
    await setOAuthProviderEnabled(ADAPTER_ID, true);
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "tenant_id", value: "tenant-123", sensitive: false });
    // client_id / client_secret deliberately not set
    await expect(microsoftEntraIdAdapter.isConfigured()).resolves.toBe(false);
  });

  it("isConfigured() is true once every required field is set AND enabled", async () => {
    await setOAuthProviderEnabled(ADAPTER_ID, true);
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "tenant_id", value: "tenant-123", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: "client-123", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_secret", value: "secret-123", sensitive: true });
    await expect(microsoftEntraIdAdapter.isConfigured()).resolves.toBe(true);
  });

  it("beginAuth() throws MissingOAuthConfigError when not configured, without ever reaching the network", async () => {
    await expect(microsoftEntraIdAdapter.beginAuth("https://app.example.com/login/microsoft-entra-id/callback")).rejects.toThrow(
      MissingOAuthConfigError,
    );
  });

  it("beginAuth() builds a spec-correct Microsoft identity-platform v2.0 authorize URL once configured", async () => {
    await setOAuthProviderEnabled(ADAPTER_ID, true);
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "tenant_id", value: "contoso-tenant", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: "contoso-client", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_secret", value: "contoso-secret", sensitive: true });

    const redirectUri = "https://app.example.com/login/microsoft-entra-id/callback";
    const result = await microsoftEntraIdAdapter.beginAuth(redirectUri);

    const url = new URL(result.url);
    expect(url.origin).toBe("https://login.microsoftonline.com");
    expect(url.pathname).toBe("/contoso-tenant/oauth2/v2.0/authorize");
    expect(url.searchParams.get("client_id")).toBe("contoso-client");
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(result.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(result.codeVerifier).toBeTruthy();
    expect(result.state).toBeTruthy();
  });

  it("completeAuth() throws MissingOAuthConfigError when not configured, without ever reaching the network", async () => {
    await expect(
      microsoftEntraIdAdapter.completeAuth({
        code: "irrelevant",
        codeVerifier: "irrelevant",
        redirectUri: "https://app.example.com/login/microsoft-entra-id/callback",
      }),
    ).rejects.toThrow(MissingOAuthConfigError);
  });

  it("completeAuth() rejects with OAuthAuthenticationError (not a raw error) with no codeVerifier, before any network call", async () => {
    await setOAuthProviderEnabled(ADAPTER_ID, true);
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "tenant_id", value: `t-${runId}`, sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: `c-${runId}`, sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_secret", value: `s-${runId}`, sensitive: true });

    await expect(
      microsoftEntraIdAdapter.completeAuth({
        code: "fake-code",
        redirectUri: "https://app.example.com/login/microsoft-entra-id/callback",
      }),
    ).rejects.toThrow(OAuthAuthenticationError);
  });

  it("listOAuthProviderStatuses includes the real Microsoft adapter, driving the Super Admin UI without a hardcoded list", async () => {
    await setOAuthProviderEnabled(ADAPTER_ID, true);
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "tenant_id", value: "t", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: "c", sensitive: false });
    await setOAuthProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_secret", value: "s", sensitive: true });

    const statuses = await listOAuthProviderStatuses();
    const mine = statuses.find((s) => s.id === ADAPTER_ID);
    expect(mine).toBeDefined();
    expect(mine!.displayName).toBe("Microsoft / Entra ID");
    expect(mine!.configured).toBe(true);
  });
});

describe("mapEntraClaimsToProfile (pure claims normalization)", () => {
  it("maps a standard v2.0 id_token's claims to an OAuthProfile, treating a present email as verified", () => {
    const profile = mapEntraClaimsToProfile({ sub: "abc-123", email: "user@contoso.com", name: "Ada Lovelace" });
    expect(profile).toEqual({
      provider: ADAPTER_ID,
      providerUserId: "abc-123",
      email: "user@contoso.com",
      emailVerified: true,
      name: "Ada Lovelace",
    });
  });

  it("falls back to preferred_username when email is absent (some Entra tenants omit the email claim)", () => {
    const profile = mapEntraClaimsToProfile({ sub: "abc-123", preferred_username: "user@contoso.onmicrosoft.com" });
    expect(profile).not.toBeNull();
    expect(profile!.email).toBe("user@contoso.onmicrosoft.com");
    expect(profile!.emailVerified).toBe(true);
  });

  it("returns null when neither email nor preferred_username is present — caller must reject, not fabricate an identity", () => {
    expect(mapEntraClaimsToProfile({ sub: "abc-123" })).toBeNull();
  });
});
