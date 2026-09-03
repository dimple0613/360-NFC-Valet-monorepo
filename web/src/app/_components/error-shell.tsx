"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const NAVY_GRADIENT = "linear-gradient(150deg, #16213a, #1c2b46 55%, #2a3c61)";
const SUNSET_GRADIENT = "linear-gradient(135deg, #F4531F, #FF8A50)";

function LogoIcon({ size = 22 }: { size?: number }) {
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

export interface ErrorAction {
  href?: string;
  label: string;
  variant: "navy" | "outline";
  onClick?: () => void;
}

type Portal = "console" | "tenant-admin" | "super-admin";

// The App Router serves every portal (Super Admin, Tenant Admin) plus the
// marketing/auth routes. Errors thrown inside a portal should send the user
// back to THAT portal (dashboard + login) — never to the legacy /console app
// that owns its own 404 page. Detect the portal from the current path so the
// per-status handlers (forbidden.tsx / not-found.tsx / unauthorized.tsx /
// error.tsx) all route users correctly without repeating the logic.
function usePortal(): Portal {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/super-admin")) return "super-admin";
  if (pathname.startsWith("/tenant-admin")) return "tenant-admin";
  return "console";
}

const PORTAL_BRAND: Record<Portal, { brand: string; headline: string; sub: string }> = {
  console: {
    brand: "360 NFC Valet",
    headline: "Every car back at the curb before the guest is.",
    sub: "Run every property, driver and NFC card from one console — and see the day's numbers as they happen.",
  },
  "tenant-admin": {
    brand: "360 NFC Valet · Admin",
    headline: "Run your organization from the Admin portal.",
    sub: "Manage your team, billing, notifications and platform settings in one place.",
  },
  "super-admin": {
    brand: "360 NFC Valet · Super Admin",
    headline: "Platform operations for every customer, from one console.",
    sub: "Manage customers, roles, plans, billing and platform settings across your whole workspace.",
  },
};

const PORTAL_ACTIONS: Record<Portal, { dashboard: string; login: string }> = {
  console: { dashboard: "/console/dashboard", login: "/console/login" },
  "tenant-admin": { dashboard: "/tenant-admin", login: "/login" },
  "super-admin": { dashboard: "/super-admin", login: "/login" },
};

export default function ErrorShell({
  status,
  title,
  body,
  actions,
  headline,
  sub,
}: {
  status: string;
  title: string;
  body: string;
  actions: ErrorAction[];
  headline?: string;
  sub?: string;
}) {
  const portal = usePortal();
  const brand = PORTAL_BRAND[portal];

  // For the Super Admin and Tenant Admin portals, override the caller's
  // console-centric links with portal-correct ones, but keep any in-place
  // actions (e.g. the 500 handler's "Try again" retry button). The console
  // keeps the caller-provided actions verbatim.
  const callerOnClick = actions.filter((a) => a.onClick);
  const resolvedActions =
    portal === "console"
      ? actions
      : [
          ...callerOnClick,
          {
            href: PORTAL_ACTIONS[portal].dashboard,
            label: "Go to dashboard",
            variant: "navy" as const,
          },
          {
            href: PORTAL_ACTIONS[portal].login,
            label: "Back to login",
            variant: "outline" as const,
          },
        ];

  return (
    <div
      className="console-error"
      style={{ display: "flex", minHeight: "100vh" }}
    >
      <div
        style={{
          flex: 1.1,
          background: NAVY_GRADIENT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 52px",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              background: SUNSET_GRADIENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoIcon size={22} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
            {brand.brand}
          </span>
        </div>

        <div>
          <div
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-1px",
              lineHeight: 1.2,
              maxWidth: 420,
            }}
          >
            {headline ?? brand.headline}
          </div>
          <div
            style={{
              fontSize: 14.5,
              color: "#9fb0cc",
              fontWeight: 500,
              marginTop: 16,
              lineHeight: 1.7,
              maxWidth: 420,
            }}
          >
            {sub ?? brand.sub}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "#5e6f8f", fontWeight: 600 }}>
          © 2026 We Want 360 · Dubai, UAE
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          background: "#fff",
        }}
      >
        <div style={{ width: 380, maxWidth: "100%", textAlign: "center" }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1,
              background: SUNSET_GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {status}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#6C7A93",
              fontWeight: 500,
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            {body}
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 26,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {resolvedActions.map((a) => (
              <Action key={a.label} {...a}>
                {a.label}
              </Action>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Action({
  href,
  variant,
  onClick,
  children,
}: ErrorAction & { children: ReactNode }) {
  const base = {
    padding: "12px 22px",
    borderRadius: 99,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  } as const;
  const variantStyle =
    variant === "navy"
      ? { background: "#1C2B46", color: "#fff" }
      : { border: "1.5px solid #E7EAF0", color: "#1C2B46" };
  const style = { ...base, ...variantStyle };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={style}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} style={style}>
      {children}
    </a>
  );
}