import { NextResponse } from "next/server";
import { getAccessSettings } from "@saasclaude/db";

// Edge-safe public flag endpoint consumed by proxy.ts (the single Next 16
// proxy file) to decide whether to serve the maintenance page. It must stay
// exempt from the maintenance gate — proxy.ts only applies that gate to
// non-API, non-super-admin page paths, so this route is never interposed on
// by the gate and cannot loop back into itself.
//
// Reads the SAME platform_setting key ("access.maintenance_mode") that the
// Super Admin "Settings > General" tab writes via setAccessSettings, so the
// gate and the toggle always agree.
export async function GET() {
  const access = await getAccessSettings();
  return NextResponse.json({ maintenanceMode: access.maintenanceMode });
}
