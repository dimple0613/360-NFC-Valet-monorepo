import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getLocations, createLocation } from "@/app/tenant-admin/_lib/valet-data";
import { assertValetPermission, errorMessage, errorCode } from "@/app/tenant-admin/_lib/valet-permissions";

export async function GET() {
  if (!(await assertValetPermission("valet.property.read"))) {
    return NextResponse.json({ error: "You don't have permission to view locations" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const data = await getLocations(identity.session.organizationId ?? null);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!(await assertValetPermission("valet.property.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage locations" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { name, area, zones, slots, cards, imageUrl, validatesValet, staffCode } = body || {};
  if (!name || !slots) {
    return NextResponse.json({ error: "Name and slot count are required" }, { status: 400 });
  }
  try {
    const created = await createLocation(
      { name, area, zones, slots, cards, imageUrl, validatesValet: typeof validatesValet === "boolean" ? validatesValet : undefined, staffCode: typeof staffCode === "string" ? staffCode : undefined },
      identity.session.organizationId ?? null
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (errorCode(err) === "23505") {
      return NextResponse.json({ error: "A location with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage(err, "Failed to create location") }, { status: 500 });
  }
}
