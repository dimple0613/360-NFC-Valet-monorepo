import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { updateLocation, deleteLocation } from "@/app/tenant-admin/_lib/valet-data";
import { assertValetPermission, errorMessage, errorCode } from "@/app/tenant-admin/_lib/valet-permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertValetPermission("valet.property.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage locations" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const { name, area, zones, slots, cards, imageUrl, validatesValet, staffCode } = body || {};
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  try {
    const updated = await updateLocation(id,
      { name, area, zones, slots, cards, imageUrl, validatesValet: typeof validatesValet === "boolean" ? validatesValet : undefined, staffCode: typeof staffCode === "string" ? staffCode : undefined },
      identity.session.organizationId ?? null
    );
    return NextResponse.json(updated);
  } catch (err) {
    if (errorCode(err) === "23505") {
      return NextResponse.json({ error: "A location with this name already exists" }, { status: 400 });
    }
    if (errorMessage(err, "") === "Location not found") {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertValetPermission("valet.property.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage locations" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  try {
    await deleteLocation(id, identity.session.organizationId ?? null);
    return NextResponse.json({ id });
  } catch (err) {
    if (errorMessage(err, "") === "Location not found") {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to remove location" }, { status: 500 });
  }
}
