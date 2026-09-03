import { NextResponse } from "next/server";
import { getActiveSubscription, getPlanById } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.billing.read");
  if (denied) return denied;

  const subscription = await getActiveSubscription(apiKey.organizationId);
  if (!subscription) return NextResponse.json({ subscription: null });

  const plan = await getPlanById(subscription.planId);
  return NextResponse.json({
    subscription: {
      id: subscription.id,
      status: subscription.status,
      planKey: plan?.key ?? null,
      planName: plan?.name ?? null,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelAt: subscription.cancelAt,
    },
  });
});
