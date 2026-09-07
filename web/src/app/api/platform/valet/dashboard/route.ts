import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getDashboardData } from "@/app/tenant-admin/_lib/valet-data";
import { assertValetPermission } from "@/app/tenant-admin/_lib/valet-permissions";

export async function GET(req: Request) {
  if (!(await assertValetPermission("valet.dashboard.read"))) {
    return NextResponse.json({ error: "You don't have permission to view the dashboard" }, { status: 403 });
  }
  const identity = await requireIdentity();

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days")) || 7;
  const property = url.searchParams.get("property") || "all";
  const propertyId = property === "all" ? null : String(property);

  const data = await getDashboardData(days, propertyId, identity.session.organizationId ?? null);
  return NextResponse.json({
    stats: data.stats,
    byProperty: data.byProperty,
    chart: data.chart,
    live: data.live,
    properties: data.properties,
    fetchedAt: new Date().toISOString(),
  });
}