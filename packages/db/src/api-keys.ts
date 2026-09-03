import { createHash, randomBytes } from "node:crypto";
import type { ApiKey } from "../generated/client";
import { prismaWithoutTenantScoping } from "./client";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "./list-query";

// FR-322: API keys are managed per organization with scopes and expiry —
// the real credential behind FR-103's API-side tenant resolution, replacing
// the placeholder that trusted a bare X-Organization-Id header. Same
// raw-token/hash split as Session (session.ts) and VerificationToken: the
// raw key is shown exactly once at creation and never stored, only its
// SHA-256 hash is — a DB leak alone can't let someone replay a key.

const KEY_BYTES = 24;
const KEY_PREFIX_LENGTH = 12;

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super("API key is invalid, expired, or has been revoked.");
    this.name = "InvalidApiKeyError";
  }
}

export class ApiKeyNotFoundError extends Error {
  constructor(apiKeyId: string) {
    super(`No API key with id ${apiKeyId}.`);
    this.name = "ApiKeyNotFoundError";
  }
}

export interface CreateApiKeyInput {
  organizationId: string;
  name: string;
  /** Permission-catalog keys (Permission.key) this key may act with — see ApiKey's schema comment for why scopes are checked directly against the key rather than through a User's roles. */
  scopes: string[];
  expiresAt?: Date;
  createdByUserId?: string;
}

export interface CreatedApiKey {
  rawKey: string;
  apiKey: ApiKey;
}

/** The raw key is returned exactly once — the caller must display/store it now; it cannot be recovered afterward (only keyHash persists). */
export async function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  const rawKey = `sk_${randomBytes(KEY_BYTES).toString("base64url")}`;
  const apiKey = await prismaWithoutTenantScoping.apiKey.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH),
      keyHash: hashKey(rawKey),
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      createdByUserId: input.createdByUserId,
    },
  });
  return { rawKey, apiKey };
}

export interface ResolvedApiKey {
  id: string;
  organizationId: string;
  name: string;
  scopes: string[];
}

/** Looks up a key by its raw value, rejecting expired/revoked ones, and bumps lastUsedAt. This is the API request hot path — keep it to a single indexed lookup. */
export async function verifyApiKey(rawKey: string): Promise<ResolvedApiKey> {
  const apiKey = await prismaWithoutTenantScoping.apiKey.findUnique({ where: { keyHash: hashKey(rawKey) } });
  if (!apiKey || apiKey.revokedAt !== null || (apiKey.expiresAt !== null && apiKey.expiresAt.getTime() < Date.now())) {
    throw new InvalidApiKeyError();
  }
  await prismaWithoutTenantScoping.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  return { id: apiKey.id, organizationId: apiKey.organizationId, name: apiKey.name, scopes: apiKey.scopes };
}

export function apiKeyHasScope(apiKey: Pick<ResolvedApiKey, "scopes">, scopeKey: string): boolean {
  return apiKey.scopes.includes(scopeKey);
}

/** Never selects keyHash — a listing view has no legitimate use for it, even hashed. */
export async function listApiKeys(organizationId: string): Promise<Omit<ApiKey, "keyHash">[]> {
  return prismaWithoutTenantScoping.apiKey.findMany({
    where: { organizationId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdByUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

const API_KEY_SORT_FIELDS = ["createdAt", "name", "keyPrefix", "lastUsedAt", "expiresAt"] as const;

/** Offset-paginated, searchable, sortable variant for the DataTable UI — only non-revoked keys, same as the existing listApiKeys consumer's own client-side filter. */
export async function listApiKeysSearch(
  organizationId: string,
  params: ListQueryParams = {},
): Promise<ListQueryResult<Omit<ApiKey, "keyHash">>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = API_KEY_SORT_FIELDS.includes(params.sortBy as (typeof API_KEY_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof API_KEY_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = {
    organizationId,
    revokedAt: null,
    ...(params.q ? { name: { contains: params.q, mode: "insensitive" as const } } : {}),
  };
  const select = {
    id: true,
    organizationId: true,
    name: true,
    keyPrefix: true,
    scopes: true,
    lastUsedAt: true,
    expiresAt: true,
    revokedAt: true,
    createdByUserId: true,
    createdAt: true,
  } as const;

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.apiKey.findMany({ where, select, orderBy: { [sortBy]: sortDir }, ...toSkipTake(page, pageSize) }),
    prismaWithoutTenantScoping.apiKey.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

export async function revokeApiKey(organizationId: string, apiKeyId: string): Promise<void> {
  const { count } = await prismaWithoutTenantScoping.apiKey.updateMany({
    where: { id: apiKeyId, organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new ApiKeyNotFoundError(apiKeyId);
}
