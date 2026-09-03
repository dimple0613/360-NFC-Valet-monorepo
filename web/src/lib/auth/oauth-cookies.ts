import { cookies } from "next/headers";

// Short-lived, httpOnly cookies carrying the OAuth `state` (CSRF protection,
// both providers) and `codeVerifier` (PKCE, Google only — Apple's client is
// confidential, no verifier needed) between the initiate and callback legs.
// Namespaced per provider so a user could in principle have both flows
// in-flight in different tabs without colliding.

const MAX_AGE_SECONDS = 10 * 60;

function stateCookieName(provider: string): string {
  return `oauth_${provider}_state`;
}
function codeVerifierCookieName(provider: string): string {
  return `oauth_${provider}_code_verifier`;
}

export async function setOAuthStateCookies(params: {
  provider: string;
  state: string;
  codeVerifier?: string;
  /**
   * Apple's callback is a cross-site POST (its own domain posting the result
   * to ours) — a `SameSite=Lax` cookie (Google's case: a same-site top-level
   * GET redirect) is never sent along with that, so Apple needs `None`.
   * Browsers require `Secure` whenever `SameSite=None` is set, which in turn
   * requires HTTPS — this is a real, unavoidable snag for testing the Apple
   * flow specifically on plain local http (Google is unaffected). Flagged
   * in TASKS.md, not silently glossed over.
   */
  sameSiteNone?: boolean;
}): Promise<void> {
  const cookieStore = await cookies();
  const sameSite = params.sameSiteNone ? "none" : "lax";
  const secure = params.sameSiteNone || process.env.NODE_ENV === "production";
  cookieStore.set(stateCookieName(params.provider), params.state, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  if (params.codeVerifier) {
    cookieStore.set(codeVerifierCookieName(params.provider), params.codeVerifier, {
      httpOnly: true,
      secure,
      sameSite,
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  }
}

export async function readOAuthStateCookies(provider: string): Promise<{ state: string | null; codeVerifier: string | null }> {
  const cookieStore = await cookies();
  return {
    state: cookieStore.get(stateCookieName(provider))?.value ?? null,
    codeVerifier: cookieStore.get(codeVerifierCookieName(provider))?.value ?? null,
  };
}

export async function clearOAuthStateCookies(provider: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(stateCookieName(provider));
  cookieStore.delete(codeVerifierCookieName(provider));
}
