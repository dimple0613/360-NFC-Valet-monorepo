"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The auth shell is shared across every auth route, but the console varies the
// left-brand-panel text per page (and only shows the network stats on /login).
// Each page renders <AuthLeftContent> with its own headline/sub/stats; the
// shared <AuthLeftPanel> in the layout reads this through context.
// Brand identity (name, logo, copyright) is platform-configurable and arrives
// from the layout's AuthLeftProvider, fed from the Settings > Branding + Pages
// & content surfaces.

export interface AuthLeftData {
  headline: string;
  sub: string;
  showStats: boolean;
}

export interface AuthBranding {
  siteName: string;
  siteDescription: string | null;
  logoLightUrl: string | null;
  copyright: string;
  supportEmail: string | null;
}

export const AUTH_HEADLINE = "Every car back at the curb before the guest is.";
export const DEFAULT_BRANDING: AuthBranding = {
  siteName: "360 NFC Valet",
  siteDescription: null,
  logoLightUrl: null,
  copyright: "© 2026 We Want 360 · Dubai, UAE",
  supportEmail: null,
};

const DEFAULT_LEFT: AuthLeftData = {
  headline: AUTH_HEADLINE,
  sub: "",
  showStats: false,
};

const AuthLeftContext = createContext<AuthLeftData>(DEFAULT_LEFT);
const AuthLeftSetContext = createContext<(data: AuthLeftData) => void>(() => {});
const AuthBrandingContext = createContext<AuthBranding>(DEFAULT_BRANDING);

export function AuthLeftProvider({
  children,
  branding,
}: {
  children: ReactNode;
  branding?: AuthBranding;
}) {
  const [data, setData] = useState<AuthLeftData>(DEFAULT_LEFT);
  return (
    <AuthLeftSetContext.Provider value={setData}>
      <AuthLeftContext.Provider value={data}>
        <AuthBrandingContext.Provider value={branding ?? DEFAULT_BRANDING}>{children}</AuthBrandingContext.Provider>
      </AuthLeftContext.Provider>
    </AuthLeftSetContext.Provider>
  );
}

// Rendered by each auth page (as the first child of its subtree) to declare its
// own left-panel text. Returns nothing — it only feeds the shared panel.
export function AuthLeftContent({ headline, sub, showStats }: AuthLeftData) {
  const setData = useContext(AuthLeftSetContext);
  useEffect(() => {
    setData({ headline, sub, showStats });
  }, [headline, sub, showStats, setData]);
  return null;
}

export const NETWORK_STATS = [
  { value: "NFC", label: "tap-to-park cards" },
  { value: "Live", label: "real-time queue" },
  { value: "Multi", label: "property dashboard" },
];

// Same logo glyph as the console's LogoIcon (tenant-admin/_components/valet-icons) so the
// App Router brand matches /console/login pixel-for-pixel. When the platform has an uploaded
// logo, that renders instead.
export function BrandLogo({ size = 22, src }: { size?: number; src?: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: "contain", maxWidth: "100%", maxHeight: "100%" }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a7 7 0 0 1 0 8" />
      <path d="M9.5 5.5a11 11 0 0 1 0 13" />
      <path d="M13 3a15 15 0 0 1 0 18" />
    </svg>
  );
}

// The navy brand panel. Rendered once by the layout; content comes from
// whichever page set <AuthLeftContent> and the platform branding settings.
export function AuthLeftPanel() {
  const { headline, sub, showStats } = useContext(AuthLeftContext);
  const branding = useContext(AuthBrandingContext);
  return (
    <div className="login-left">
      <div className="login-brand">
        <div className="login-logo">
          <BrandLogo size={22} src={branding.logoLightUrl} />
        </div>
        <div>
          <span className="login-brand-name">{branding.siteName}</span>
          {branding.siteDescription ? <div className="login-brand-desc">{branding.siteDescription}</div> : null}
        </div>
      </div>
      <div>
        <div className="login-headline">{headline}</div>
        {sub ? <div className="login-sub">{sub}</div> : null}
        {showStats ? (
          <div className="login-stats">
            {NETWORK_STATS.map((stat) => (
              <div key={stat.label}>
                <div className="login-stat-value">{stat.value}</div>
                <div className="login-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="login-footer">
        {branding.supportEmail ? (
          <span className="login-footer-support">
            Need help? <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a>
          </span>
        ) : null}
        <span>{branding.copyright}</span>
      </div>
    </div>
  );
}
