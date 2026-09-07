import { verifyDriverToken, type DriverClaims } from "@/lib/driver-jwt";

// Shared guard for the /api/driver/* and /api/auth/driver-* routes. The driver
// app authenticates with `Authorization: Bearer <jwt>` (it stores the token
// itself — there are no cookies in an Expo app). 401 means "not signed in" and
// the app wipes its stored session on that status, so every guard failure must
// produce exactly that shape.

export function driverFromRequest(req: Request): DriverClaims | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyDriverToken(auth.slice(7));
}

export function requireDriver(req: Request): { claims: DriverClaims } | Response {
  const claims = driverFromRequest(req);
  if (!claims) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  return { claims };
}

export function driverIdFrom(req: Request): { driverId: number } | Response {
  const claims = driverFromRequest(req);
  if (!claims) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  return { driverId: claims.driverId };
}