"use server";

import { revalidatePath } from "next/cache";
import { createPlanVersion, setPlanVisibility, UnknownFeatureError, type PlanType, type PlanVisibility, type BillingCycle } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_PLANS_PERMISSION = "core.platform.manage_plans";

export interface CreatePlanVersionFormState {
  error: string | null;
}

function parseCents(raw: FormDataEntryValue | null): number | undefined {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return undefined;
  const dollars = Number(trimmed);
  if (Number.isNaN(dollars) || dollars < 0) return undefined;
  return Math.round(dollars * 100);
}

function parseIntOrUndefined(raw: FormDataEntryValue | null): number | undefined {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isNaN(value) ? undefined : Math.round(value);
}

export async function createPlanVersionAction(
  _prevState: CreatePlanVersionFormState,
  formData: FormData,
): Promise<CreatePlanVersionFormState> {
  try {
    await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as PlanType;
  if (!key) return { error: "A plan key is required." };
  if (!name) return { error: "A plan name is required." };
  if (!type) return { error: "A plan type is required." };

  const description = String(formData.get("description") ?? "").trim() || undefined;
  const visibility = (String(formData.get("visibility") ?? "PUBLIC") || "PUBLIC") as PlanVisibility;
  const priceCents = parseCents(formData.get("priceDollars"));
  const currency = String(formData.get("currency") ?? "usd").trim() || "usd";
  const billingCycleRaw = String(formData.get("billingCycle") ?? "").trim();
  const billingCycle = billingCycleRaw ? (billingCycleRaw as BillingCycle) : undefined;
  const trialDays = parseIntOrUndefined(formData.get("trialDays"));
  const gracePeriodDays = parseIntOrUndefined(formData.get("gracePeriodDays")) ?? 0;

  const resourceKeys = formData.getAll("resourceKey").map(String);
  const resources = resourceKeys.map((resourceTypeKey) => {
    const limitRaw = String(formData.get(`resourceLimit_${resourceTypeKey}`) ?? "").trim();
    const limit = limitRaw ? Number(limitRaw) : null;
    return { resourceTypeKey, limit: Number.isNaN(limit) ? null : limit };
  });

  const featureKeys = formData.getAll("featureKey").map(String);
  const features = featureKeys.map((featureKey) => ({ featureKey, enabled: true }));

  const termsOfServiceDisabled = formData.get("termsOfServiceDisabled") === "on";
  const termsOfService = String(formData.get("termsOfService") ?? "").trim() || undefined;

  try {
    await createPlanVersion({
      key,
      name,
      type,
      description,
      visibility,
      priceCents,
      currency,
      billingCycle,
      trialDays,
      gracePeriodDays,
      resources: resources.length > 0 ? resources : undefined,
      features: features.length > 0 ? features : undefined,
      termsOfService,
      termsOfServiceDisabled,
    });
  } catch (error) {
    if (error instanceof UnknownFeatureError) return { error: error.message };
    throw error;
  }

  revalidatePath("/super-admin/plans");
  return { error: null };
}

export async function setPlanVisibilityAction(planId: string, formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  const visibility = String(formData.get("visibility") ?? "") as PlanVisibility;
  if (!visibility) throw new Error("Select a visibility.");
  await setPlanVisibility(planId, visibility);
  revalidatePath("/super-admin/plans");
}
