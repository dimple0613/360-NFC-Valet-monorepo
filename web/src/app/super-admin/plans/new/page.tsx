import { PlusIcon } from "lucide-react";
import { getCurrentPlan, listActiveCurrencies, listFeatures, listResourceTypes } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { PlanVersionForm, type PlanVersionDefaults } from "../plan-version-form";

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ copyFrom?: string }>;
}) {
  await requirePlatformAccess("core.platform.manage_plans");
  const { copyFrom } = await searchParams;

  const [resourceTypes, features, currencies, copySource] = await Promise.all([
    listResourceTypes(),
    listFeatures(),
    listActiveCurrencies(),
    copyFrom ? getCurrentPlan(copyFrom) : null,
  ]);
  const featureKeyById = new Map(features.map((f) => [f.id, f.key]));

  const formDefaults: PlanVersionDefaults | undefined = copySource
    ? {
        key: "",
        name: `${copySource.name} copy`,
        type: copySource.type,
        description: copySource.description,
        visibility: copySource.visibility,
        priceDollars: copySource.priceCents ? (copySource.priceCents / 100).toString() : "",
        currency: copySource.currency,
        billingCycle: copySource.billingCycle,
        trialDays: copySource.trialDays,
        gracePeriodDays: copySource.gracePeriodDays,
        resourceLimits: Object.fromEntries(
          copySource.resources.map((r) => [r.resourceTypeKey, r.limit === null ? "" : String(r.limit)]),
        ),
        featureKeys: new Set(
          copySource.features
            .filter((f) => f.enabled)
            .map((f) => featureKeyById.get(f.featureId))
            .filter((key): key is string => key !== undefined),
        ),
        termsOfService: copySource.termsOfService,
        termsOfServiceDisabled: copySource.termsOfServiceDisabled,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PlusIcon className="size-5" />}
        title={copySource ? `Copy of ${copySource.name}` : "Create plan"}
        description="Configure pricing, billing cycle, feature entitlements, and resource limits for this plan."
      />

      <PlanVersionForm
        resourceTypes={resourceTypes.map((r) => ({ key: r.key, displayName: r.displayName, unit: r.unit }))}
        features={features.map((f) => ({ key: f.key, name: f.name }))}
        currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
        defaults={formDefaults}
      />
    </div>
  );
}
