import { NextResponse } from "next/server";
import { beginAppleAuth, MissingOAuthConfigError } from "@saasclaude/db";
import { resolveBaseUrl } from "@/lib/base-url";
import { setOAuthStateCookies } from "@/lib/auth/oauth-cookies";

export async function GET() {
  const baseUrl = resolveBaseUrl();
  try {
    const { url, state } = beginAppleAuth(`${baseUrl}/login/apple/callback`);
    // sameSiteNone: Apple's callback is a cross-site POST from apple.com, a
    // Lax cookie (fine for Google's same-site GET redirect) would never be
    // sent along with it.
    await setOAuthStateCookies({ provider: "apple", state, sameSiteNone: true });
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof MissingOAuthConfigError) {
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
