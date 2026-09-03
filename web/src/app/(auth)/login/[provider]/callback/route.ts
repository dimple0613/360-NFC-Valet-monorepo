import { NextRequest, NextResponse } from "next/server";
import { getOAuthAdapter, OAuthAuthenticationError, UnverifiedEmailConflictError } from "@saasclaude/db";
import { resolveBaseUrl } from "@/lib/base-url";
import { clearOAuthStateCookies, readOAuthStateCookies } from "@/lib/auth/oauth-cookies";
import { finishOAuthSignIn } from "@/lib/auth/oauth-callback";

/**
 * Generic callback counterpart to `../route.ts`. GET-only — every adapter
 * built against the OAuthAdapter contract so far (Microsoft/Entra ID) uses a
 * standard authorization-code GET redirect, same as Google's hand-written
 * callback. Apple's mandatory `response_mode=form_post` POST callback is the
 * one real shape difference in this codebase (see oauth-adapter.ts's header
 * comment) — it stays on its own hand-written route rather than being forced
 * through here; a future POST-based adapter would need this file to grow a
 * POST handler, not a redesign.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const baseUrl = resolveBaseUrl();
  const adapter = getOAuthAdapter(provider);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const { state: storedState, codeVerifier } = await readOAuthStateCookies(provider);
  await clearOAuthStateCookies(provider);

  if (!adapter || !code || !returnedState || !storedState || returnedState !== storedState) {
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent("Sign-in failed. Please try again.")}`);
  }

  try {
    const profile = await adapter.completeAuth({
      code,
      codeVerifier: codeVerifier ?? undefined,
      redirectUri: `${baseUrl}/login/${provider}/callback`,
    });
    return await finishOAuthSignIn(profile, baseUrl);
  } catch (error) {
    if (error instanceof OAuthAuthenticationError || error instanceof UnverifiedEmailConflictError) {
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
