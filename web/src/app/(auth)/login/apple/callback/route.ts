import { NextRequest, NextResponse } from "next/server";
import { completeAppleAuth, OAuthAuthenticationError, UnverifiedEmailConflictError } from "@saasclaude/db";
import { resolveBaseUrl } from "@/lib/base-url";
import { clearOAuthStateCookies, readOAuthStateCookies } from "@/lib/auth/oauth-cookies";
import { finishOAuthSignIn } from "@/lib/auth/oauth-callback";

/** Apple's `response_mode=form_post` sends this as an application/x-www-form-urlencoded POST, not a GET redirect with query params — the one real shape difference from Google's callback. */
export async function POST(req: NextRequest) {
  const baseUrl = resolveBaseUrl();
  const form = await req.formData();
  const code = form.get("code");
  const returnedState = form.get("state");

  const { state: storedState } = await readOAuthStateCookies("apple");
  await clearOAuthStateCookies("apple");

  if (typeof code !== "string" || typeof returnedState !== "string" || !storedState || returnedState !== storedState) {
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent("Apple sign-in failed. Please try again.")}`);
  }

  try {
    const profile = await completeAppleAuth({ code, redirectUri: `${baseUrl}/login/apple/callback` });
    return await finishOAuthSignIn(profile, baseUrl);
  } catch (error) {
    if (error instanceof OAuthAuthenticationError || error instanceof UnverifiedEmailConflictError) {
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
