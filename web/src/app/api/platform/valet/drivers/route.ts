import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import {
  getDrivers,
  getDriverDetail,
  createDriver,
  toggleDriverShift,
  resetDriverPassword,
  updateDriver,
  removeDriver,
} from "@/app/tenant-admin/_lib/valet-data";

export async function GET(req: Request) {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId ?? null;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    try {
      const detail = await getDriverDetail(Number(id), organizationId);
      return NextResponse.json(detail);
    } catch (err: any) {
      if (err?.message === "Driver not found") {
        return NextResponse.json({ error: "Driver not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to load driver" }, { status: 500 });
    }
  }
  const property = url.searchParams.get("property") || "all";
  const q = url.searchParams.get("q") || "";
  const page = Number(url.searchParams.get("page")) || 1;
  const pageSize = Number(url.searchParams.get("pageSize")) || 25;
  const sort = url.searchParams.get("sort") || "";
  const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
  const data = await getDrivers({ property, q, page, pageSize, sort, dir, organizationId });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const identity = await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { name, propertyId, email, phone, emiratesId, licenseNumber, nationality, emergencyContact, password } = body || {};
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!password || String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  try {
    const created = await createDriver({
      name,
      propertyId,
      email,
      phone,
      emiratesId,
      licenseNumber,
      nationality,
      emergencyContact,
      password,
    }, identity.session.organizationId ?? null);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create driver" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { id, shift, newPassword, remove, name, propertyId, email, phone, emiratesId, licenseNumber, nationality, emergencyContact } = body || {};
  const driverId = Number(id);
  if (!driverId) return NextResponse.json({ error: "Driver id is required" }, { status: 400 });
  try {
    if (remove) {
      await removeDriver(driverId);
      return NextResponse.json({ id, removed: true });
    }
    if (newPassword) {
      if (String(newPassword).length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      await resetDriverPassword(driverId, String(newPassword));
      return NextResponse.json({ id, passwordReset: true });
    }
    if (name !== undefined) {
      await updateDriver(driverId, { name, propertyId, email, phone, emiratesId, licenseNumber, nationality, emergencyContact });
      return NextResponse.json({ id, updated: true });
    }
    if (shift !== undefined) {
      await toggleDriverShift(driverId, !!shift);
      return NextResponse.json({ id, shift: !!shift });
    }
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update driver" }, { status: 500 });
  }
}
