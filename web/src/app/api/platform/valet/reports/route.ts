import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getReports } from "@/app/tenant-admin/_lib/valet-data";

export async function GET(req: Request) {
  const identity = await requireIdentity();

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days")) || 7;
  const property = url.searchParams.get("property") || "all";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  const data = await getReports({ days, property, from, to, organizationId: identity.session.organizationId ?? null });
  return NextResponse.json({
    rows: data.rows,
    properties: data.properties,
    range: {
      from,
      to,
      days,
    },
  });
}
