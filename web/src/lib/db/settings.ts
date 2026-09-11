import { db, prismaWithoutTenantScoping } from "./client";
import { runWithTenant } from "./tenant-context";
import { decrypt, encrypt } from "./encryption";

import { appendFileSync } from "node:fs";
function DBG(msg: string) {
  try {
    appendFileSync("C:\\Users\\Dell\\AppData\\Local\\Temp\\opencode\\dbg.log", `${msg}\n`);
  } catch {}
}

// FR-270/FR-271: centralized settings with platform/organization/user scope,
// inheritance (resolveSetting below), and encryption at rest for sensitive
// values. See schema.prisma for why this is three models, not one.

export interface SetSettingInput {
  category: string;
  key: string;
  value: unknown;
  isSensitive?: boolean;
}

export interface SettingSummary {
  category: string;
  key: string;
  isSensitive: boolean;
  /** "[REDACTED]" for sensitive settings — listing is for UI display, not for reading secrets back out. */
  value: unknown;
}

const REDACTED = "[REDACTED]";

function serialize(input: SetSettingInput): { value: string; isSensitive: boolean } {
  const serialized = JSON.stringify(input.value);
  return {
    value: input.isSensitive ? encrypt(serialized) : serialized,
    isSensitive: Boolean(input.isSensitive),
  };
}

function deserialize<T>(row: { value: string; isSensitive: boolean }): T {
  const raw = row.isSensitive ? decrypt(row.value) : row.value;
  return JSON.parse(raw) as T;
}

// --- Platform scope ---

export async function setPlatformSetting(input: SetSettingInput): Promise<void> {
  DBG(`setPlatformSetting ENTER key=${input.key} value=${JSON.stringify(input.value)} ENCRYPTION_KEY_SET=${!!process.env.ENCRYPTION_KEY}`);
  const { value, isSensitive } = serialize(input);
  DBG(`setPlatformSetting serialized key=${input.key} value=${value} isSensitive=${isSensitive} DATABASE_URL=${process.env.DATABASE_URL}`);
  try {
    const r = await prismaWithoutTenantScoping.platformSetting.upsert({
      where: { key: input.key },
      create: { category: input.category, key: input.key, value, isSensitive },
      update: { category: input.category, value, isSensitive },
    });
    DBG(`setPlatformSetting OK key=${input.key} id=${r.id}`);
  } catch (e) {
    DBG(`setPlatformSetting THREW key=${input.key} err=${(e as Error).message}`);
    throw e;
  }
}

export async function getPlatformSetting<T = unknown>(key: string): Promise<T | undefined> {
  const row = await prismaWithoutTenantScoping.platformSetting.findUnique({ where: { key } });
  return row ? deserialize<T>(row) : undefined;
}

export async function listPlatformSettings(): Promise<SettingSummary[]> {
  const rows = await prismaWithoutTenantScoping.platformSetting.findMany();
  return rows.map((row) => ({
    category: row.category,
    key: row.key,
    isSensitive: row.isSensitive,
    value: row.isSensitive ? REDACTED : JSON.parse(row.value),
  }));
}

// --- Organization scope (tenant-scoped, see tenant-scoping.ts) ---

export async function setOrganizationSetting(organizationId: string, input: SetSettingInput): Promise<void> {
  const { value, isSensitive } = serialize(input);
  await runWithTenant(organizationId, async () => {
    // The compound unique key's organizationId must be the real value here —
    // the tenant-scoping extension injects a top-level organizationId filter,
    // but can't reach into this nested compound-key object to fix it up.
    await db.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: input.key } },
      create: { organizationId, category: input.category, key: input.key, value, isSensitive },
      update: { category: input.category, value, isSensitive },
    });
  });
}

export async function getOrganizationSetting<T = unknown>(
  organizationId: string,
  key: string,
): Promise<T | undefined> {
  return runWithTenant(organizationId, async () => {
    const row = await db.organizationSetting.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    return row ? deserialize<T>(row) : undefined;
  });
}

export async function listOrganizationSettings(organizationId: string): Promise<SettingSummary[]> {
  return runWithTenant(organizationId, async () => {
    const rows = await db.organizationSetting.findMany();
    return rows.map((row) => ({
      category: row.category,
      key: row.key,
      isSensitive: row.isSensitive,
      value: row.isSensitive ? REDACTED : JSON.parse(row.value),
    }));
  });
}

// --- User scope (not tenant-scoped — a user's personal settings aren't owned by one org) ---

export async function setUserSetting(userId: string, input: SetSettingInput): Promise<void> {
  const { value, isSensitive } = serialize(input);
  await prismaWithoutTenantScoping.userSetting.upsert({
    where: { userId_key: { userId, key: input.key } },
    create: { userId, category: input.category, key: input.key, value, isSensitive },
    update: { category: input.category, value, isSensitive },
  });
}

export async function getUserSetting<T = unknown>(userId: string, key: string): Promise<T | undefined> {
  const row = await prismaWithoutTenantScoping.userSetting.findUnique({
    where: { userId_key: { userId, key } },
  });
  return row ? deserialize<T>(row) : undefined;
}

export async function listUserSettings(userId: string): Promise<SettingSummary[]> {
  const rows = await prismaWithoutTenantScoping.userSetting.findMany({ where: { userId } });
  return rows.map((row) => ({
    category: row.category,
    key: row.key,
    isSensitive: row.isSensitive,
    value: row.isSensitive ? REDACTED : JSON.parse(row.value),
  }));
}

// --- Resolution (FR-271: inheritance/override, most specific wins) ---

export interface ResolvedSetting<T> {
  value: T;
  source: "user" | "organization" | "platform";
}

/**
 * Resolves the effective value of `key` for the given scope combination: a
 * user-level override wins over an organization-level override, which wins
 * over the platform default. Omit organizationId/userId to resolve at a
 * broader scope only (e.g. no userId → organization-or-platform).
 */
export async function resolveSetting<T = unknown>(params: {
  key: string;
  organizationId?: string;
  userId?: string;
}): Promise<ResolvedSetting<T> | undefined> {
  if (params.userId) {
    const value = await getUserSetting<T>(params.userId, params.key);
    if (value !== undefined) return { value, source: "user" };
  }
  if (params.organizationId) {
    const value = await getOrganizationSetting<T>(params.organizationId, params.key);
    if (value !== undefined) return { value, source: "organization" };
  }
  const value = await getPlatformSetting<T>(params.key);
  if (value !== undefined) return { value, source: "platform" };
  return undefined;
}
