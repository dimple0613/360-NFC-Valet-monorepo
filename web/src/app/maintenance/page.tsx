import type { Metadata } from "next";
import { getAccessSettings } from "@saasclaude/db";
import { MaintenanceShell } from "./maintenance-shell";

export const metadata: Metadata = {
  title: "Maintenance",
};

// The page proxy.ts rewrites (or redirects) visitors to while maintenance
// mode is enabled. It is deliberately NOT gated behind any auth or permission
// check — the proxy already decided this user is non-super-admin and
// non-exempt, and this page must render for everyone (including unauthenticated
// visitors) without triggering a redirect loop back into /maintenance.
export default async function MaintenancePage() {
  const access = await getAccessSettings();
  return <MaintenanceShell message={access.maintenanceMessage} />;
}
