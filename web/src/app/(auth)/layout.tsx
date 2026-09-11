import type { Metadata } from "next";
import { getBrandingSettings, getPageContentSettings } from "../../lib/db";
import { AuthLeftPanel, AuthLeftProvider, type AuthBranding } from "./auth-left";

export async function generateMetadata(): Promise<Metadata> {
  const [branding, content] = await Promise.all([getBrandingSettings(), getPageContentSettings()]);
  const siteName = content.brandName || branding.siteName || "360 NFC Valet";
  return {
    title: siteName,
    description: branding.siteDescription ?? undefined,
  };
}

// Pixel-parity with the console (/console/login): the SAME navy brand panel +
// white form panel, same class names (.login / .login-left / .login-right /
// .login-form) as valet/styles/globals.css. One layout for every auth route —
// the left panel text is page-driven (via <AuthLeftContent>), the identity
// (name/logo/tagline/copyright/support) is platform-driven from Settings >
// Branding + Pages & content, and the right renders `children`.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [branding, content] = await Promise.all([getBrandingSettings(), getPageContentSettings()]);
  const brandingProps: AuthBranding = {
    siteName: content.brandName || branding.siteName || "360 NFC Valet",
    siteDescription: branding.siteDescription,
    logoLightUrl: branding.logoLightUrl,
    copyright: content.copyright,
    supportEmail: content.supportEmail,
  };
  return (
    <AuthLeftProvider branding={brandingProps}>
      <div className="login-login">
        <div className="login">
          <AuthLeftPanel />
          <div className="login-right">
            {children}
            {/* Kept in the DOM (hidden) so it can be toggled without removing —
                /login still matches the console which shows no such line. */}
            <p className="hidden text-center text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </AuthLeftProvider>
  );
}