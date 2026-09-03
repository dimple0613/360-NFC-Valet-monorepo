import type { ResourceAggregation, ResourceOveragePolicy, ResourceResetCycle } from "../../generated/client";
import { prismaWithoutTenantScoping } from "../client";

// FR-170–172: resource types (API requests, storage, seats, custom
// module-defined types, ...) are a registry, not a schema change per type —
// the same self-registration/idempotent-upsert pattern as
// permission-registry.ts. ResourceType is a global catalog (see
// schema.prisma), so this runs outside any tenant context.

export interface ResourceTypeDefinition {
  key: string;
  module: string;
  displayName: string;
  unit: string;
  aggregation: ResourceAggregation;
  resetCycle: ResourceResetCycle;
  overagePolicy: ResourceOveragePolicy;
  description?: string;
}

export class ResourceTypeKeyConflictError extends Error {
  constructor(key: string, existingModule: string, incomingModule: string) {
    super(
      `Resource type key "${key}" is already registered by module "${existingModule}" — ` +
        `module "${incomingModule}" cannot claim it. Namespace yours (e.g. "yourModule.thing") ` +
        `to avoid collisions.`,
    );
    this.name = "ResourceTypeKeyConflictError";
  }
}

/** Idempotent: safe to call on every boot/deploy, not just once — confirms adding a resource type never needs a migration. */
export async function registerResourceTypes(definitions: ResourceTypeDefinition[]): Promise<void> {
  for (const definition of definitions) {
    const existing = await prismaWithoutTenantScoping.resourceType.findUnique({
      where: { key: definition.key },
    });
    if (existing && existing.module !== definition.module) {
      throw new ResourceTypeKeyConflictError(definition.key, existing.module, definition.module);
    }

    await prismaWithoutTenantScoping.resourceType.upsert({
      where: { key: definition.key },
      create: definition,
      update: {
        module: definition.module,
        displayName: definition.displayName,
        unit: definition.unit,
        aggregation: definition.aggregation,
        resetCycle: definition.resetCycle,
        overagePolicy: definition.overagePolicy,
        description: definition.description,
      },
    });
  }
}

export async function getResourceType(key: string) {
  return prismaWithoutTenantScoping.resourceType.findUnique({ where: { key } });
}

export async function listResourceTypes() {
  return prismaWithoutTenantScoping.resourceType.findMany({ orderBy: { key: "asc" } });
}
