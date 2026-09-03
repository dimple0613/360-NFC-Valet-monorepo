import { NextRequest, NextResponse } from "next/server";
import { completeGoogleAuth, OAuthAuthenticationError, UnverifiedEmailConflictError } from "@saasclaude/db";
import { resolveBaseUrl } from "@/lib/base-url";
import { clearOAuthStateCookies, readOAuthStateCookies } from "@/lib/auth/oauth-cookies";
import { finishOAuthSignIn } from "@/lib/auth/oauth-callback";

export async function GET(req: NextRequest) {
  const baseUrl = resolveBaseUrl();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const { state: storedState, codeVerifier } = await readOAuthStateCookies("google");
  await clearOAuthStateCookies("google");

  if (!code || !returnedState || !storedState || returnedState !== storedState || !codeVerifier) {
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent("Google sign-in failed. Please try again.")}`);
  }

  try {
    const profile = await completeGoogleAuth({ code, codeVerifier, redirectUri: `${baseUrl}/login/google/callback` });
    return await finishOAuthSignIn(profile, baseUrl);
  } catch (error) {
    if (error instanceof OAuthAuthenticationError || error instanceof UnverifiedEmailConflictError) {
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
