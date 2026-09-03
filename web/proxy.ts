import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Ported from the 360 NFC Valet admin's middleware.js: adds CORS headers for
// the allowed client origins (the public/guest tap site and the mobile app)
// so they can call the API.
//
// Next 16 renamed Middleware to Proxy and allows only ONE proxy file per
// project — this is it. It therefore carries BOTH responsibilities:
//   1. CORS for cross-origin /api/* callers (the legacy pages console's CORS
//      proxy), and
//   2. the platform maintenance-mode gate for browser page navigations, so a
//      Super Admin toggling "Maintenance mode" (platform_setting
//      "access.maintenance_mode") actually blocks non-operator traffic.
//
// Proxy defaults to the Node.js runtime in Next 16, but we deliberately keep
// this file dependency-free and read the flag through a lightweight internal
// fetch to /api/mode (which queries the DB) rather than importing @saasclaude/db
// here — the gate stays simple, fast, and can never couple the proxy to Prisma
// init. The maintenance flag is memoized briefly in the proxy instance to avoid
// a DB round-trip on every navigation.

const ALLOWED = (
  process.env.CORS_ORIGINS ||
  "http://localhost:3001,http://localhost:8081,http://localhost:8082,https://360-nfc-valet-mobile.vercel.app"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAINTENANCE_FLAG_TTL_MS = 15_000;

let maintenanceCache: { on: boolean; at: number } | null = null;

async function isMaintenanceOn(req: NextRequest): Promise<boolean> {
  if (maintenanceCache && Date.now() - maintenanceCache.at < MAINTENANCE_FLAG_TTL_MS) {
    return maintenanceCache.on;
  }
  try {
    const modeUrl = new URL("/api/mode", req.nextUrl.origin);
    const res = await fetch(modeUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const on = res.ok ? Boolean((await res.json()).maintenanceMode) : false;
    maintenanceCache = { on, at: Date.now() };
    return on;
  } catch {
    // If the flag endpoint is unavailable, stay open — never brick the app on
    // an infrastructure hiccup. Maintenance mode failing closed would take the
    // whole platform down with a transient error.
    return false;
  }
}

function handleCors(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED.includes(origin)) return NextResponse.next();

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  return res;
}

async function handleMaintenance(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Never gate the maintenance page itself (it must render to tell the visitor
  // what's happening) or the Super Admin portal (the operator must be able to
  // turn the flag back off, including the server action on
  // /super-admin/settings/general). Deep-link APIs and the /api/mode flag
  // reader are also exempt (they are not "browser pages").
  if (
    pathname === "/maintenance" ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    req.method !== "GET"
  ) {
    return NextResponse.next();
  }

  // Skip client-side prefetches: they must mirror the real page's access, and
  // gating them breaks the router's prefetch handshake.
  if (req.headers.get("purpose") === "prefetch" || req.headers.get("next-router-prefetch")) {
    return NextResponse.next();
  }

  if (await isMaintenanceOn(req)) {
    const res = NextResponse.rewrite(new URL("/maintenance", req.url));
    res.headers.set("x-maintenance-mode", "1");
    return res;
  }

  return NextResponse.next();
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Cross-origin API callers get CORS handling.
  if (pathname.startsWith("/api/")) {
    return handleCors(req);
  }

  // Browser page navigations get the maintenance gate (and a no-op next()).
  return handleMaintenance(req);
}

export const config = {
  matcher: [
    // Proxy runs on every request except static build assets, image
    // optimization, favicon and common metadata files. Both the API CORS path
    // and the maintenance gate branch inside the handler stay cheap for the
    // requests they don't care about.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|woff2?)$).*)",
  ],
};
