import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getUserPlatformPermissions } from "@saasclaude/db";
import {
  listCardsForTable,
  registerCards,
  updateCardUid,
  setCardStatus,
  removeCard,
} from "@/app/tenant-admin/_lib/valet-data";
import { assertValetPermission, errorMessage } from "@/app/tenant-admin/_lib/valet-permissions";

export async function GET(req: Request) {
  if (!(await assertValetPermission("valet.card.read"))) {
    return NextResponse.json({ error: "You don't have permission to view cards" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const page = Number(url.searchParams.get("page")) || 1;
  const pageSize = Number(url.searchParams.get("pageSize")) || 15;
  const sortBy = url.searchParams.get("sortBy") || "";
  const sortDir = url.searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  const status = url.searchParams.get("status") || "all";
  const property = url.searchParams.get("property") || "all";
  const data = await listCardsForTable({ q, page, pageSize, sortBy, sortDir, status, property, organizationId: identity.session.organizationId ?? null });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const identity = await requireIdentity();
  // Card registration is platform inventory work: only a Super Admin (a user
  // holding a platform role) may create card batches. Ordinary tenant members
  // manage cards that already exist; they never mint new ones.
  const platformUserId = identity.session.impersonatorUserId ?? identity.user.id;
  const platformPermissions = await getUserPlatformPermissions(platformUserId);
  if (platformPermissions.length === 0) {
    return NextResponse.json({ error: "Only Super Administrators can register cards" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { propertyId, prefix, from, to } = body || {};
  if (!propertyId) return NextResponse.json({ error: "Property is required" }, { status: 400 });
  try {
    const created = await registerCards({
      propertyId: Number(propertyId),
      prefix,
      from: Number(from),
      to: Number(to),
      organizationId: identity.session.organizationId ?? null,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to register cards") }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  if (!(await assertValetPermission("valet.card.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage cards" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { id, action, uid, remove } = body || {};
  const cardId = Number(id);
  if (!cardId) return NextResponse.json({ error: "Card id is required" }, { status: 400 });
  const organizationId = identity.session.organizationId ?? null;
  try {
    if (remove) {
      await removeCard(cardId, organizationId);
      return NextResponse.json({ id, removed: true });
    }
    if (action === "updateUid") {
      const res = await updateCardUid(cardId, uid || "", organizationId);
      return NextResponse.json({ id, updated: true, uid: res.uid });
    }
    if (action === "block" || action === "unblock" || action === "mark-returned" || action === "lost") {
      await setCardStatus(cardId, action, organizationId);
      return NextResponse.json({ id, updated: true });
    }
    return NextResponse.json({ error: "action must be 'block', 'unblock', 'mark-returned', 'lost' or 'updateUid'" }, { status: 400 });
  } catch (err) {
    if (errorMessage(err, "") === "Card not found") {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json({ error: errorMessage(err, "Failed to update card") }, { status: 400 });
  }
}
