import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { updateLocation, deleteLocation } from "@/app/tenant-admin/_lib/valet-data";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireIdentity();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const { name, area, zones, slots, cards, imageUrl } = body || {};
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  try {
    const updated = await updateLocation(id, { name, area, zones, slots, cards, imageUrl });
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A location with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireIdentity();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  try {
    await deleteLocation(id);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "Failed to remove location" }, { status: 500 });
  }
}
