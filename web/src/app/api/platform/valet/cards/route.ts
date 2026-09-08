import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { getUserPlatformPermissions } from "@saasclaude/db";
import {
  listCardsForTable,
  registerCards,
  assignCardToProperty,
  unassignCard,
  markCardDefect,
  markCardPrinted,
  setCardStatus,
  removeCard,
  getCardDeck,
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

// #48: a platform caller (Super Admin with valet.card.create/print) may scope
// card operations to the organization a /super-admin/organizations/[id] tab is
// viewing — mint into that org's properties, assign/unassign its cards, remove
// its property cards. Tenant callers never get that: they stay scoped to their
// session organization (an orgId passed in the request body/query is ignored).
async function isPlatformCardOp(): Promise<boolean> {
  return (
    (await hasPlatformPermission("valet.card.create")) ||
    (await hasPlatformPermission("valet.card.print"))
  );
}

async function resolveOrgScope(sessionOrgId: string | null, requestedOrgId: string | null): Promise<string | null> {
  if (await isPlatformCardOp()) return requestedOrgId ?? sessionOrgId;
  return sessionOrgId;
}

export async function GET(req: Request) {
  const identity = await requireIdentity();
  if (!(await isPlatformCardOp()) && !(await assertValetPermission("valet.card.read"))) {
    return NextResponse.json({ error: "You don't have permission to view cards" }, { status: 403 });
  }
  const url = new URL(req.url);
  const orgScope = await resolveOrgScope(
    identity.session.organizationId ?? null,
    url.searchParams.get("organizationId"),
  );
  const q = url.searchParams.get("q") || "";
  const page = Number(url.searchParams.get("page")) || 1;
  const pageSize = Number(url.searchParams.get("pageSize")) || 15;
  const sortBy = url.searchParams.get("sortBy") || "";
  const sortDir = url.searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  const status = url.searchParams.get("status") || "all";
  const property = url.searchParams.get("property") || "all";
  const data = await listCardsForTable({ q, page, pageSize, sortBy, sortDir, status, property, organizationId: orgScope });
  let deck = null;
  try {
    deck = await getCardDeck();
  } catch {
    deck = null;
  }
  return NextResponse.json({ ...data, deck });
}

export async function POST(req: Request) {
  // Creating a card batch is platform work (#48 E) — only a Super Admin with
  // the platform `valet.card.create` permission may register cards. The form is
  // the batch register flow: 3-letter prefix + From/To range, minted into the
  // platform deck as unassigned (assignment happens afterwards per-card).
  if (!(await hasPlatformPermission("valet.card.create"))) {
    return NextResponse.json({ error: "Only Super Administrators can create cards" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { propertyId, prefix, from, to, organizationId } = body || {};
  try {
    const created = await registerCards({
      propertyId: propertyId ? Number(propertyId) : null,
      prefix,
      from: Number(from),
      to: Number(to),
      organizationId: await resolveOrgScope(
        identity.session.organizationId ?? null,
        organizationId ? String(organizationId) : null,
      ),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to register cards") }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const identity = await requireIdentity();
  // Platform card ops (create/print permissions) unlock the deck + org-scoped
  // surfaces; otherwise the tenant `valet.card.manage` gate stays intact.
  const platformOp = await isPlatformCardOp();
  if (!platformOp && !(await assertValetPermission("valet.card.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage cards" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { id, uid, action, propertyId, remove, organizationId } = body || {};
  const cardId = Number(id);
  // uid-keyed actions (assign/unassign/printed/defect) work off the card UID and
  // don't need a real card row id — the assign dialog sends id:0. Every other
  // mutation needs the card id.
  const uidKeyed = action === "assign" || action === "unassign" || action === "printed" || action === "defect";
  if (!uidKeyed && !cardId) return NextResponse.json({ error: "Card id is required" }, { status: 400 });
  const sessionOrgId = identity.session.organizationId ?? null;
  const orgScope = await resolveOrgScope(sessionOrgId, organizationId ? String(organizationId) : null);
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
      await assignCardToProperty(uid || "", Number(propertyId), orgScope);
      return NextResponse.json({ id, updated: true });
    }
    if (action === "unassign") {
      await unassignCard(uid || "", orgScope);
      return NextResponse.json({ id, updated: true });
    }
    if (remove) {
      await removeCard(cardId, orgScope);
      return NextResponse.json({ id, removed: true });
    }
    if (action === "block" || action === "unblock" || action === "mark-returned" || action === "lost") {
      await setCardStatus(cardId, action, orgScope);
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