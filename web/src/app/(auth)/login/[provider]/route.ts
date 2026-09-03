import { NextResponse } from "next/server";
import { getOAuthAdapter, MissingOAuthConfigError } from "@saasclaude/db";
import { resolveBaseUrl } from "@/lib/base-url";
import { setOAuthStateCookies } from "@/lib/auth/oauth-cookies";

// The generic half of the OAuthAdapter framework: unlike google/route.ts and
// apple/route.ts (hand-written, one file per provider), this single dynamic
// route serves EVERY adapter registered via oauth-registry.ts —
// Microsoft/Entra ID today, anything registered tomorrow, with zero new
// route files. Next.js resolves the literal "google"/"apple" segments in
// preference to this catch-all when both exist side by side, so adding this
// doesn't change Google/Apple's existing behavior at all.
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const baseUrl = resolveBaseUrl();
  const adapter = getOAuthAdapter(provider);
  if (!adapter) {
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent("Unknown sign-in provider.")}`);
  }

  try {
    const { url, state, codeVerifier } = await adapter.beginAuth(`${baseUrl}/login/${provider}/callback`);
    await setOAuthStateCookies({ provider, state, codeVerifier });
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof MissingOAuthConfigError) {
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
