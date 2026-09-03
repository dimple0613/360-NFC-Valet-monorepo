"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The auth shell is shared across every auth route, but the console varies the
// left-brand-panel text per page (and only shows the network stats on /login).
// Each page renders <AuthLeftContent> with its own headline/sub/stats; the
// shared <AuthLeftPanel> in the layout reads this through context.

export interface AuthLeftData {
  headline: string;
  sub: string;
  showStats: boolean;
}

export const AUTH_HEADLINE = "Every car back at the curb before the guest is.";

const DEFAULT_LEFT: AuthLeftData = {
  headline: AUTH_HEADLINE,
  sub: "",
  showStats: false,
};

const AuthLeftContext = createContext<AuthLeftData>(DEFAULT_LEFT);
const AuthLeftSetContext = createContext<(data: AuthLeftData) => void>(() => {});

export function AuthLeftProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AuthLeftData>(DEFAULT_LEFT);
  return (
    <AuthLeftSetContext.Provider value={setData}>
      <AuthLeftContext.Provider value={data}>{children}</AuthLeftContext.Provider>
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
// App Router brand matches /console/login pixel-for-pixel.
export function BrandLogo({ size = 22 }: { size?: number }) {
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
// whichever page set <AuthLeftContent>.
export function AuthLeftPanel() {
  const { headline, sub, showStats } = useContext(AuthLeftContext);
  return (
    <div className="login-left">
      <div className="login-brand">
        <div className="login-logo">
          <BrandLogo size={22} />
        </div>
        <span className="login-brand-name">360 NFC Valet</span>
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
      <div className="login-footer">© 2026 We Want 360 · Dubai, UAE</div>
    </div>
  );
}
