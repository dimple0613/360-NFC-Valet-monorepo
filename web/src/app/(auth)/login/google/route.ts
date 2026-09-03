import { NextResponse } from "next/server";
import { beginGoogleAuth, MissingOAuthConfigError } from "@saasclaude/db";
import { resolveBaseUrl } from "@/lib/base-url";
import { setOAuthStateCookies } from "@/lib/auth/oauth-cookies";

export async function GET() {
  const baseUrl = resolveBaseUrl();
  try {
    const { url, state, codeVerifier } = beginGoogleAuth(`${baseUrl}/login/google/callback`);
    await setOAuthStateCookies({ provider: "google", state, codeVerifier });
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof MissingOAuthConfigError) {
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
