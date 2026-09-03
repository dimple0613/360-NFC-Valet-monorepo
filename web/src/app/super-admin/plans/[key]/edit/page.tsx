import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { getCurrentPlan, listActiveCurrencies, listFeatures, listResourceTypes } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, PLAN_VISIBILITY_STYLES } from "@/components/status-badge";
import { PlanVersionForm, type PlanVersionDefaults } from "../../plan-version-form";

export default async function EditPlanPage({ params }: { params: Promise<{ key: string }> }) {
  await requirePlatformAccess("core.platform.manage_plans");
  const { key } = await params;

  const [plan, resourceTypes, features, currencies] = await Promise.all([
    getCurrentPlan(key),
    listResourceTypes(),
    listFeatures(),
    listActiveCurrencies(),
  ]);
  if (!plan) notFound();

  const featureKeyById = new Map(features.map((f) => [f.id, f.key]));
  const formDefaults: PlanVersionDefaults = {
    key: plan.key,
    name: plan.name,
    type: plan.type,
    description: plan.description,
    visibility: plan.visibility,
    priceDollars: plan.priceCents ? (plan.priceCents / 100).toString() : "",
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    trialDays: plan.trialDays,
    gracePeriodDays: plan.gracePeriodDays,
    resourceLimits: Object.fromEntries(
      plan.resources.map((r) => [r.resourceTypeKey, r.limit === null ? "" : String(r.limit)]),
    ),
    featureKeys: new Set(
      plan.features
        .filter((f) => f.enabled)
        .map((f) => featureKeyById.get(f.featureId))
        .filter((key): key is string => key !== undefined),
    ),
    termsOfService: plan.termsOfService,
    termsOfServiceDisabled: plan.termsOfServiceDisabled,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PencilIcon className="size-5" />}
        title={plan.name}
        titleTrailing={<StatusBadge value={plan.visibility} styles={PLAN_VISIBILITY_STYLES} />}
        description="Update this plan's pricing, billing cycle, features, and resource limits."
      />

      <PlanVersionForm
        resourceTypes={resourceTypes.map((r) => ({ key: r.key, displayName: r.displayName, unit: r.unit }))}
        features={features.map((f) => ({ key: f.key, name: f.name }))}
        currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
        defaults={formDefaults}
        keyLocked
      />
    </div>
  );
}
