import { NextResponse } from "next/server";
import { getBrandingSettings, getPageContentSettings } from "@saasclaude/db";

// Public, unauthenticated: serves the non-sensitive brand identity + error-page
// copy that visitor-facing surfaces need. Auth pages read settings server-side;
// the client-only 500 handler (error.tsx) and the root layout's favicon
// injector fetch this instead. No tenant data, so nothing here is a
// cross-tenant leak.
export const dynamic = "force-dynamic";

export async function GET() {
  const [branding, content] = await Promise.all([getBrandingSettings(), getPageContentSettings()]);

  return NextResponse.json(
    {
      brandName: content.brandName || branding.siteName || "360 NFC Valet",
      copyright: content.copyright,
      supportEmail: content.supportEmail,
      logoLightUrl: branding.logoLightUrl,
      logoDarkUrl: branding.logoDarkUrl,
      faviconUrl: branding.faviconUrl,
      error404: { title: content.error404Title, body: content.error404Body },
      error403: { title: content.error403Title, body: content.error403Body },
      error401: { title: content.error401Title, body: content.error401Body },
      error500: { title: content.error500Title, body: content.error500Body },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}