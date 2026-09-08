import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getUserPlatformPermissions } from "@saasclaude/db";
import {
  listCardsForTable,
  createDeckCards,
  assignCardToProperty,
  unassignCard,
  markCardDefect,
  markCardPrinted,
  setCardStatus,
  removeCard,
} from "@/app/tenant-admin/_lib/valet-data";
import { assertValetPermission, errorMessage } from "@/app/tenant-admin/_lib/valet-permissions";

// #48 deck access control:
// - valet.card.create  (PLATFORM) — mint cards into the deck (single/bulk)
// - valet.card.print   (PLATFORM) — mark a card printed (freeze) or defect
// - valet.card.manage  (TENANT)   — assign/unassign cards to own properties,
//                                   plus the existing operational status ops
// - valet.card.read    (TENANT)   — view
async function platformUserId(): Promise<string> {
  const identity = await requireIdentity();
  return identity.session.impersonatorUserId ?? identity.user.id;
}

async function hasPlatformPermission(key: string): Promise<boolean> {
  const permissions = await getUserPlatformPermissions(await platformUserId());
  return permissions.includes(key);
}

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
  // Minting deck inventory is platform work (#48 E) — only a Super Admin with
  // the platform `valet.card.create` permission may create cards.
  if (!(await hasPlatformPermission("valet.card.create"))) {
    return NextResponse.json({ error: "Only Super Administrators can create cards" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { count, propertyId } = body || {};
  try {
    const created = await createDeckCards({
      count: Number(count),
      propertyId: propertyId ? Number(propertyId) : null,
      organizationId: identity.session.organizationId ?? null,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to create cards") }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  if (!(await assertValetPermission("valet.card.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage cards" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { id, uid, action, propertyId, remove } = body || {};
  const cardId = Number(id);
  if (!cardId) return NextResponse.json({ error: "Card id is required" }, { status: 400 });
  const organizationId = identity.session.organizationId ?? null;
  try {
    // Platform-only actions: marking a card printed freezes UID + property;
    // marking it defect retires it. Both need the platform print permission.
    if (action === "printed") {
      if (!(await hasPlatformPermission("valet.card.print"))) {
        return NextResponse.json({ error: "Only Super Administrators can complete a print run" }, { status: 403 });
      }
      await markCardPrinted(uid || "", identity.user.id);
      return NextResponse.json({ id, updated: true });
    }
    if (action === "defect") {
      if (!(await hasPlatformPermission("valet.card.print"))) {
        return NextResponse.json({ error: "Only Super Administrators can mark cards defect" }, { status: 403 });
      }
      await markCardDefect(uid || "");
      return NextResponse.json({ id, updated: true });
    }
    // The org's card assigning option (#48 E): assign/unassign to its own
    // properties. No create / no edit / no print for the org.
    if (action === "assign") {
      await assignCardToProperty(uid || "", Number(propertyId), organizationId);
      return NextResponse.json({ id, updated: true });
    }
    if (action === "unassign") {
      await unassignCard(uid || "", organizationId);
      return NextResponse.json({ id, updated: true });
    }
    if (remove) {
      await removeCard(cardId, organizationId);
      return NextResponse.json({ id, removed: true });
    }
    if (action === "block" || action === "unblock" || action === "mark-returned" || action === "lost") {
      await setCardStatus(cardId, action, organizationId);
      return NextResponse.json({ id, updated: true });
    }
    return NextResponse.json(
      { error: "action must be 'assign', 'unassign', 'printed', 'defect', 'block', 'unblock', 'mark-returned' or 'lost'" },
      { status: 400 }
    );
  } catch (err) {
    if (errorMessage(err, "") === "Card not found") {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json({ error: errorMessage(err, "Failed to update card") }, { status: 400 });
  }
}