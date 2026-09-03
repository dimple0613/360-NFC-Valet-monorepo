import { Apple, Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { decodeBase64IgnorePadding } from "@oslojs/encoding";
import { prismaWithoutTenantScoping } from "../client";
import { acceptPendingInviteForOAuthUser } from "../organization-invites";
import { MissingOAuthConfigError, OAuthAuthenticationError, type OAuthAuthorizeResult, type OAuthProfile } from "./oauth-adapter";

// FR-220's provider architecture: Google and Apple are the first two OAuth2/
// OIDC providers (Local was the first, Phase 1B). Deliberately platform-wide
// config only (env vars, same pattern as STRIPE_SECRET_KEY) — FR-221's harder
// case (per-org enterprise SSO with an org's own IdP) is a distinct, bigger
// feature, not attempted here. Arctic (lightweight, typed, Fetch-based OAuth2
// client) was chosen over pulling in a full auth framework like Auth.js,
// matching this codebase's existing pattern of small focused libraries
// (otpauth for MFA, @node-rs/argon2 for hashing) that compose with the
// already-built Session/AuthProvider machinery rather than replacing it.
//
// `MissingOAuthConfigError`/`OAuthAuthenticationError`/`OAuthProfile`/
// `BeginOAuthResult` now live in oauth-adapter.ts (the shared adapter
// contract added alongside Microsoft/Entra ID) and are re-exported here
// unchanged — see that file's header comment for why Google/Apple aren't
// wrapped as OAuthAdapter objects themselves.
export { MissingOAuthConfigError, OAuthAuthenticationError };
export type { OAuthProfile };

/** The provider reported an unverified email that already belongs to another account — can't safely auto-link it (an unverified email is, by definition, not vouched-for), and User.email is globally unique so creating a second account isn't possible either. */
export class UnverifiedEmailConflictError extends Error {
  constructor() {
    super("An account with this email already exists. Sign in with your password, then link this provider from Security settings.");
    this.name = "UnverifiedEmailConflictError";
  }
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isAppleConfigured(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY,
  );
}

function createGoogleClient(redirectUri: string): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new MissingOAuthConfigError("Google");
  return new Google(clientId, clientSecret, redirectUri);
}

/** PKCS#8 PEM -> raw key bytes Arctic's Apple client expects. The env var carries the PEM as-is (headers, real newlines or literal \n both fine). */
function decodeApplePrivateKey(pem: string): Uint8Array {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\\n/g, "")
    .replace(/\s/g, "");
  return decodeBase64IgnorePadding(base64);
}

function createAppleClient(redirectUri: string): Apple {
  const clientId = process.env.APPLE_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKeyPem = process.env.APPLE_PRIVATE_KEY;
  if (!clientId || !teamId || !keyId || !privateKeyPem) throw new MissingOAuthConfigError("Apple");
  return new Apple(clientId, teamId, keyId, decodeApplePrivateKey(privateKeyPem), redirectUri);
}

/** Alias kept for backward compatibility with existing call sites/exports — identical to the shared OAuthAuthorizeResult (oauth-adapter.ts). Only Google uses PKCE via Arctic's API here — Apple's client is confidential (its "secret" is the signed JWT), no code verifier needed. */
export type BeginOAuthResult = OAuthAuthorizeResult;

export function beginGoogleAuth(redirectUri: string): BeginOAuthResult {
  const google = createGoogleClient(redirectUri);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);
  return { url: url.toString(), state, codeVerifier };
}

export function beginAppleAuth(redirectUri: string): BeginOAuthResult {
  const apple = createAppleClient(redirectUri);
  const state = generateState();
  const url = apple.createAuthorizationURL(state, ["name", "email"]);
  // Apple requires this whenever scopes are requested — it POSTs the result
  // to the callback instead of a GET redirect with query params.
  url.searchParams.set("response_mode", "form_post");
  return { url: url.toString(), state };
}

interface GoogleIdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export async function completeGoogleAuth(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthProfile> {
  const google = createGoogleClient(params.redirectUri);
  let idToken: string;
  try {
    const tokens = await google.validateAuthorizationCode(params.code, params.codeVerifier);
    idToken = tokens.idToken();
  } catch {
    throw new OAuthAuthenticationError("Google");
  }
  const claims = decodeIdToken(idToken) as GoogleIdTokenClaims;
  if (!claims.email) throw new OAuthAuthenticationError("Google");
  return {
    provider: "google",
    providerUserId: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true,
    name: claims.name,
  };
}

interface AppleIdTokenClaims {
  sub: string;
  email?: string;
  // Apple's own quirk: this claim is the string "true"/"false", not a boolean.
  email_verified?: string | boolean;
}

export async function completeAppleAuth(params: { code: string; redirectUri: string }): Promise<OAuthProfile> {
  const apple = createAppleClient(params.redirectUri);
  let idToken: string;
  try {
    const tokens = await apple.validateAuthorizationCode(params.code);
    idToken = tokens.idToken();
  } catch {
    throw new OAuthAuthenticationError("Apple");
  }
  const claims = decodeIdToken(idToken) as AppleIdTokenClaims;
  if (!claims.email) throw new OAuthAuthenticationError("Apple");
  return {
    provider: "apple",
    providerUserId: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
  };
}

/** Tenant Admin Security page: which providers this user has linked. View-only for now — unlinking is a follow-up, not in this round's scope. */
export async function listLinkedOAuthAccounts(userId: string): Promise<{ provider: string; createdAt: Date }[]> {
  return prismaWithoutTenantScoping.oAuthAccount.findMany({
    where: { userId },
    select: { provider: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export interface ResolvedOAuthSignIn {
  userId: string;
  isNewUser: boolean;
  mfaRequired: boolean;
  /** Set when a brand-new user's email matched a pending invite, which was auto-accepted — the caller skips the "name your organization" screen and lands them straight in this org. */
  joinedOrganizationId: string | null;
}

/**
 * The shared resolution step for both providers: link to an existing
 * OAuthAccount, auto-link to an existing User by verified email, or create a
 * brand-new User. See TASKS.md for the full design writeup — summarized:
 * verified-email auto-linking is standard SaaS behavior (the provider itself
 * vouches for the email); a genuinely new user either lands in a pending
 * invite's org automatically or is sent to name their own; MFA is a property
 * of the account, not the login method, so it's still enforced here exactly
 * like local login.
 */
export async function resolveOAuthSignIn(profile: OAuthProfile): Promise<ResolvedOAuthSignIn> {
  const existingLink = await prismaWithoutTenantScoping.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId } },
  });
  if (existingLink) {
    const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: existingLink.userId } });
    return { userId: user.id, isNewUser: false, mfaRequired: user.mfaEnabled, joinedOrganizationId: null };
  }

  const userByEmail = await prismaWithoutTenantScoping.user.findUnique({ where: { email: profile.email } });
  if (userByEmail && !profile.emailVerified) throw new UnverifiedEmailConflictError();
  const existingUser = profile.emailVerified ? userByEmail : null;

  const user =
    existingUser ??
    (await prismaWithoutTenantScoping.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
      },
    }));
  const isNewUser = !existingUser;

  await prismaWithoutTenantScoping.oAuthAccount.create({
    data: { userId: user.id, provider: profile.provider, providerUserId: profile.providerUserId },
  });

  if (!isNewUser) {
    return { userId: user.id, isNewUser: false, mfaRequired: user.mfaEnabled, joinedOrganizationId: null };
  }

  const acceptedInvite = await acceptPendingInviteForOAuthUser(profile.email, user.id);
  return {
    userId: user.id,
    isNewUser: true,
    mfaRequired: false, // a brand-new account can't have MFA enabled yet
    joinedOrganizationId: acceptedInvite?.organizationId ?? null,
  };
}
