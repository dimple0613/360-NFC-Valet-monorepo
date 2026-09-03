import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import {
  listCardsForTable,
  registerCards,
  updateCardUid,
  setCardStatus,
  removeCard,
} from "@/app/tenant-admin/_lib/valet-data";

export async function GET(req: Request) {
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
  await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { propertyId, prefix, from, to } = body || {};
  if (!propertyId) return NextResponse.json({ error: "Property is required" }, { status: 400 });
  try {
    const created = await registerCards({
      propertyId: Number(propertyId),
      prefix,
      from: Number(from),
      to: Number(to),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to register cards" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { id, action, uid, remove } = body || {};
  const cardId = Number(id);
  if (!cardId) return NextResponse.json({ error: "Card id is required" }, { status: 400 });
  try {
    if (remove) {
      await removeCard(cardId);
      return NextResponse.json({ id, removed: true });
    }
    if (action === "updateUid") {
      const res = await updateCardUid(cardId, uid || "");
      return NextResponse.json({ id, updated: true, uid: res.uid });
    }
    if (action === "block" || action === "unblock" || action === "mark-returned" || action === "lost") {
      await setCardStatus(cardId, action);
      return NextResponse.json({ id, updated: true });
    }
    return NextResponse.json({ error: "action must be 'block', 'unblock', 'mark-returned', 'lost' or 'updateUid'" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update card" }, { status: 400 });
  }
}
