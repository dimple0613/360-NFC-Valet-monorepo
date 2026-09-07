import { getBrandingSettings, getPageContentSettings } from "@saasclaude/db";

// Server-side brand + error-copy bundle for the statically-originated error
// pages (not-found / forbidden / unauthorized). Mirror of the public API route,
// without the network round-trip. The client-only 500 handler uses the route.
export interface PlatformPageIdentity {
  brandName: string;
  copyright: string;
  logoLightUrl: string | null;
  errors: Record<"404" | "403" | "401" | "500", { title: string; body: string }>;
}

export async function getPlatformPageIdentity(): Promise<PlatformPageIdentity> {
  const [branding, content] = await Promise.all([getBrandingSettings(), getPageContentSettings()]);
  return {
    brandName: content.brandName || branding.siteName || "360 NFC Valet",
    copyright: content.copyright,
    logoLightUrl: branding.logoLightUrl,
    errors: {
      "404": { title: content.error404Title, body: content.error404Body },
      "403": { title: content.error403Title, body: content.error403Body },
      "401": { title: content.error401Title, body: content.error401Body },
      "500": { title: content.error500Title, body: content.error500Body },
    },
  };
}