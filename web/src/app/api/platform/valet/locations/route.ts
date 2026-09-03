import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getLocations, createLocation } from "@/app/tenant-admin/_lib/valet-data";

export async function GET() {
  const identity = await requireIdentity();
  const data = await getLocations(identity.session.organizationId ?? null);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const identity = await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { name, area, zones, slots, cards, imageUrl } = body || {};
  if (!name || !slots) {
    return NextResponse.json({ error: "Name and slot count are required" }, { status: 400 });
  }
  try {
    const created = await createLocation({ name, area, zones, slots, cards, imageUrl }, identity.session.organizationId ?? null);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A location with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
