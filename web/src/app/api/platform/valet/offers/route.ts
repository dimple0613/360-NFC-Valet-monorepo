import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import {
  listOffersForTable,
  createOffer,
  updateOffer,
  setOfferState,
  deleteOffer,
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
  const data = await listOffersForTable({ q, page, pageSize, sortBy, sortDir, status, property, organizationId: identity.session.organizationId ?? null });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { title, price, category, desc, propertyId, imageUrl, menuUrl, wasPrice } = body || {};
  if (!title || !price) return NextResponse.json({ error: "Title and price are required" }, { status: 400 });
  try {
    const created = await createOffer({
      title,
      price: Number(price),
      category,
      desc,
      propertyId,
      imageUrl,
      menuUrl,
      wasPrice: wasPrice == null ? null : Number(wasPrice),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create offer" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  await requireIdentity();
  const body = await req.json().catch(() => ({}));
  const { id, remove, live, featured, draft, title, price, category, desc, propertyId, imageUrl, menuUrl, wasPrice } = body || {};
  const offerId = Number(id);
  if (!offerId) return NextResponse.json({ error: "Offer id is required" }, { status: 400 });
  try {
    if (remove) {
      await deleteOffer(offerId);
      return NextResponse.json({ id, deleted: true });
    }
    if (title !== undefined) {
      if (!title || price === undefined) return NextResponse.json({ error: "Title and price are required" }, { status: 400 });
      await updateOffer(offerId, {
        title,
        price: Number(price),
        category,
        desc,
        propertyId,
        imageUrl,
        menuUrl,
        wasPrice: wasPrice == null ? null : Number(wasPrice),
      });
      return NextResponse.json({ id, updated: true });
    }
    if (live !== undefined || draft !== undefined || featured !== undefined) {
      await setOfferState(offerId, {
        live: typeof live === "boolean" ? live : undefined,
        draft: typeof draft === "boolean" ? draft : undefined,
        featured: featured !== undefined ? (featured === true || featured === false || featured === null ? featured : Number(featured)) : undefined,
      });
      return NextResponse.json({ id, updated: true });
    }
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update offer" }, { status: 400 });
  }
}
