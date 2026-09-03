import type { PermissionScope } from "../generated/client";
import { prismaWithoutTenantScoping } from "./client";

// FR-152: every module self-registers its permissions with the RBAC registry
// at install time — Phase 1's only registrant is core itself (core-permissions.ts).
// Permission is a global catalog (see schema.prisma), so this runs outside any
// tenant context and uses the raw client directly rather than the tenant-scoped
// `db` export.

export interface PermissionDefinition {
  key: string;
  module: string;
  scope: PermissionScope;
  description?: string;
}

export class PermissionKeyConflictError extends Error {
  constructor(key: string, existingModule: string, incomingModule: string) {
    super(
      `Permission key "${key}" is already registered by module "${existingModule}" — ` +
        `module "${incomingModule}" cannot claim it. Permission keys must be unique across ` +
        `all modules; namespace yours (e.g. "yourModule.thing.action") to avoid collisions.`,
    );
    this.name = "PermissionKeyConflictError";
  }
}

/**
 * Idempotent: safe to call on every boot/deploy, not just once. Re-registering
 * an existing key updates its description/scope in place; claiming a key another
 * module already owns throws PermissionKeyConflictError instead of silently
 * reassigning it.
 */
export async function registerPermissions(definitions: PermissionDefinition[]): Promise<void> {
  for (const definition of definitions) {
    const existing = await prismaWithoutTenantScoping.permission.findUnique({
      where: { key: definition.key },
    });
    if (existing && existing.module !== definition.module) {
      throw new PermissionKeyConflictError(definition.key, existing.module, definition.module);
    }

    await prismaWithoutTenantScoping.permission.upsert({
      where: { key: definition.key },
      create: definition,
      update: {
        module: definition.module,
        scope: definition.scope,
        description: definition.description,
      },
    });
  }
}
