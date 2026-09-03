import type { ResourceResetCycle } from "../../generated/client";
import { db } from "../client";
import { runWithTenant } from "../tenant-context";
import { getResourceType } from "./resource-types";

// FR-173: consumption tracked per organization (optionally per user),
// enforced at the service layer. Quota enforcement here takes the limit as an
// explicit parameter rather than looking it up itself — Subscription (a later
// Phase 1C task) is what actually knows an org's plan-derived quota; keeping
// this a standalone primitive that Subscription composes, rather than having
// it depend on Subscription, avoids a circular dependency between the two.

export class UnknownResourceTypeError extends Error {
  constructor(key: string) {
    super(`No resource type registered with key "${key}". Register it first (registerResourceTypes).`);
    this.name = "UnknownResourceTypeError";
  }
}

export class ResourceQuotaExceededError extends Error {
  constructor(resourceTypeKey: string, current: number, requested: number, limit: number) {
    super(
      `Resource quota exceeded for "${resourceTypeKey}": ${current} used, ` +
        `requested ${requested} more, limit is ${limit}.`,
    );
    this.name = "ResourceQuotaExceededError";
  }
}

export interface RecordUsageInput {
  organizationId: string;
  resourceTypeKey: string;
  amount: number;
  userId?: string;
  metadata?: unknown;
}

export async function recordResourceUsage(input: RecordUsageInput): Promise<void> {
  const resourceType = await getResourceType(input.resourceTypeKey);
  if (!resourceType) throw new UnknownResourceTypeError(input.resourceTypeKey);

  await runWithTenant(input.organizationId, async () => {
    // organizationId is required by the column but gets overwritten by the
    // scoping extension from the active tenant context regardless of this value
    // (same pattern as audit-log.ts).
    await db.resourceUsageEvent.create({
      data: {
        organizationId: input.organizationId,
        resourceTypeKey: input.resourceTypeKey,
        userId: input.userId,
        amount: input.amount,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: input.metadata as any,
      },
    });
  });
}

/**
 * Start of the current reset-cycle period, or null for NEVER (sum all
 * history — appropriate for a GAUGE like "current seats" or "current storage",
 * which doesn't really "reset", just accumulates net deltas forever) and for
 * BILLING_CYCLE, which needs a subscription's actual renewal date to resolve
 * — not yet wired (Subscription doesn't exist yet); treated as NEVER for now,
 * a known gap to close once the Subscription service (task 4) lands.
 */
function periodStart(resetCycle: ResourceResetCycle, now: Date): Date | null {
  switch (resetCycle) {
    case "NEVER":
    case "BILLING_CYCLE":
      return null;
    case "DAILY":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "WEEKLY": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - d.getDay());
      return d;
    }
    case "MONTHLY":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "YEARLY":
      return new Date(now.getFullYear(), 0, 1);
  }
}

export interface GetUsageOptions {
  userId?: string;
  now?: Date;
}

export async function getResourceUsage(
  organizationId: string,
  resourceTypeKey: string,
  options: GetUsageOptions = {},
): Promise<number> {
  const resourceType = await getResourceType(resourceTypeKey);
  if (!resourceType) throw new UnknownResourceTypeError(resourceTypeKey);

  const since = periodStart(resourceType.resetCycle, options.now ?? new Date());

  return runWithTenant(organizationId, async () => {
    const result = await db.resourceUsageEvent.aggregate({
      where: {
        resourceTypeKey,
        ...(options.userId ? { userId: options.userId } : {}),
        ...(since ? { recordedAt: { gte: since } } : {}),
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  });
}

/**
 * Records usage and enforces `quotaLimit` if the resource type's overage
 * policy is BLOCK. `quotaLimit: null` means unlimited (skip enforcement) —
 * used for orgs with no applicable quota, e.g. no active subscription yet.
 */
export async function recordResourceUsageWithQuota(
  input: RecordUsageInput,
  quotaLimit: number | null,
): Promise<void> {
  const resourceType = await getResourceType(input.resourceTypeKey);
  if (!resourceType) throw new UnknownResourceTypeError(input.resourceTypeKey);

  if (quotaLimit !== null && resourceType.overagePolicy === "BLOCK") {
    const current = await getResourceUsage(input.organizationId, input.resourceTypeKey, {
      userId: input.userId,
    });
    if (current + input.amount > quotaLimit) {
      throw new ResourceQuotaExceededError(input.resourceTypeKey, current, input.amount, quotaLimit);
    }
  }

  await recordResourceUsage(input);
}
