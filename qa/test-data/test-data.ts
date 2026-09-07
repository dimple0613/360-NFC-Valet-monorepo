/**
 * Test data + helpers for the 360 NFC Valet QA suite.
 *
 * Credentials and org IDs come from the live dev environment
 * (web :3000, mobile-web :3001). Every record the suite CREATES is
 * prefixed PW_TEST_<timestamp> so it is easy to identify and clean up.
 */

export const BASE = {
  web: "http://localhost:3000",
  guestWeb: "http://localhost:3001",
};

/** Super admin (platform). Owns Org A. */
export const SUPER_ADMIN = {
  email: "admin@wewant360.com",
  password: "Admin#2026Valet!",
  label: "super-admin",
};

/** Tenant B admin – a separate org, used for isolation checks. */
export const TENANT_B = {
  email: "audit.tenant.b@audit360.test",
  password: "TenantB#2026Valet!",
  label: "tenant-b",
};

export const ORG_A = "cmtqw919i000uv2v0lofioise";
export const ORG_B = "cmtqwdwbu0003v23w8pwefo5s";

/** Seeded / known data present in the live dev DB. */
export const SEED = {
  property: "360 Tower",
  driver: "Karim Valet",
  driverId: "VD-2301",
  driverEmail: "driver@360test.com",
  cardUid: "7001",
  orderPlate: "DXB-1234",
  offer: "Valet Coffee Voucher",
};

/** Utility to build unique, identifiable test records. */
export function testRunSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${Math.floor(Math.random() * 900 + 100)}`
  );
}

export function uniqueName(prefix: string): string {
  return `${prefix}_${testRunSuffix()}`;
}
