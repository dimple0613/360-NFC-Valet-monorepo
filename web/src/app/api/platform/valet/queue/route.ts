import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getQueueOrders } from "@/app/tenant-admin/_lib/valet-data";

export async function GET(req: Request) {
  const identity = await requireIdentity();

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days")) || 30;
  const property = url.searchParams.get("property") || "all";
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q") || "";
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const dir = (url.searchParams.get("sortDir") as "asc" | "desc") || "desc";
  const page = Number(url.searchParams.get("page")) || 1;
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize")) || 20));

  const data = await getQueueOrders({ days, property, status, q, sort: sortBy, dir, page, pageSize, organizationId: identity.session.organizationId ?? null });
  return NextResponse.json({
    orders: data.orders,
    counts: data.counts,
    properties: data.properties,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
    fetchedAt: new Date().toISOString(),
  });
}
