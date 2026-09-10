import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getUserPlatformPermissions } from "../../../../../lib/db";
import {
  listPrintProfiles,
  createPrintProfile,
  updatePrintProfile,
  deletePrintProfile,
} from "@/app/tenant-admin/_lib/valet-data";
import { errorMessage } from "@/app/tenant-admin/_lib/valet-permissions";

// #48 Step 3: print profiles are Super Admin (platform) managed artwork pairs
// (front + back image) used by the batch print designer. Gated on the platform
// `valet.card.print` permission — tenants cannot manage platform artwork.
async function canManage(): Promise<boolean> {
  const identity = await requireIdentity();
  const uid = identity.session.impersonatorUserId ?? identity.user.id;
  const permissions = await getUserPlatformPermissions(uid);
  return permissions.includes("valet.card.print");
}

export async function GET() {
  if (!(await canManage())) {
    return NextResponse.json({ error: "Not authorized to view print profiles" }, { status: 403 });
  }
  try {
    return NextResponse.json({ profiles: await listPrintProfiles() });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to load print profiles") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await canManage())) {
    return NextResponse.json({ error: "Not authorized to manage print profiles" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const { id } = await createPrintProfile({
      name: body?.name,
      frontImageUrl: body?.frontImageUrl ?? null,
      backImageUrl: body?.backImageUrl ?? null,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to create print profile") }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  if (!(await canManage())) {
    return NextResponse.json({ error: "Not authorized to manage print profiles" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "Print profile id is required" }, { status: 400 });
  try {
    await updatePrintProfile(id, {
      name: body?.name,
      frontImageUrl: body?.frontImageUrl,
      backImageUrl: body?.backImageUrl,
    });
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to update print profile") }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await canManage())) {
    return NextResponse.json({ error: "Not authorized to manage print profiles" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Print profile id is required" }, { status: 400 });
  try {
    await deletePrintProfile(id);
    return NextResponse.json({ removed: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to delete print profile") }, { status: 400 });
  }
}
