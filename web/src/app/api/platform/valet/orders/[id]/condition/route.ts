import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/current-user";
import { updateOrderCondition } from "@/app/tenant-admin/_lib/valet-data";
import { assertValetPermission } from "@/app/tenant-admin/_lib/valet-permissions";

// #32 tenant-admin surface: record/replace the vehicle-condition record
// (pre-existing damage / mileage / notes) against an order. Gated on
// valet.queue.manage; a cross-tenant order id behaves like a missing id (404).

const DAMAGE_CHOICES = ["scratches", "dents", "glass", "lights", "mirrors", "wheels", "other"];

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertValetPermission("valet.queue.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage orders" }, { status: 403 });
  }
  const identity = await requireIdentity();
  const { id: idStr } = await params;
  const orderId = Number(idStr);
  if (!orderId) return NextResponse.json({ error: "Invalid order id" }, { status: 400 });

  const body = await _req.json().catch(() => ({}));
  const rawDamage = Array.isArray(body?.damage) ? body.damage.filter((d: unknown) => typeof d === "string") : [];
  const damage = rawDamage.map((d: string) => d.trim().toLowerCase()).filter((d: string) => DAMAGE_CHOICES.includes(d));
  const mileageKm = Number(body?.mileageKm);
  const notes = typeof body?.notes === "string" ? body.notes : null;

  try {
    await updateOrderCondition({
      organizationId: identity.session.organizationId ?? null,
      orderId,
      condition: {
        damage,
        mileageKm: Number.isFinite(mileageKm) ? mileageKm : null,
        notes,
      },
      updatedBy: identity.user.email ?? identity.session.userId,
    });
    return NextResponse.json({ id: orderId, condition: { damage, mileageKm: Number.isFinite(mileageKm) ? mileageKm : null, notes } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message === "Order not found") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update order condition" }, { status: 500 });
  }
}