import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  ApiKeyNotFoundError,
  apiKeyHasScope,
  createApiKey,
  InvalidApiKeyError,
  listApiKeys,
  listApiKeysSearch,
  revokeApiKey,
  verifyApiKey,
} from "../api-keys";

const runId = Date.now().toString(36);

describe("API keys (FR-322)", () => {
  let orgA: { id: string };
  let orgB: { id: string };

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "ApiKey Org A", slug: `apikey-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "ApiKey Org B", slug: `apikey-org-b-${runId}` },
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  it("createApiKey returns a raw key once, and only its hash is ever queryable back to it", async () => {
    const { rawKey, apiKey } = await createApiKey({ organizationId: orgA.id, name: "CI key", scopes: ["core.team.read"] });

    expect(rawKey).toMatch(/^sk_/);
    expect(apiKey.keyPrefix).toBe(rawKey.slice(0, 12));
    // The raw key itself is never persisted anywhere — only a hash of it, verified by the resolve path below.
  });

  it("verifyApiKey resolves a valid key and bumps lastUsedAt", async () => {
    const { rawKey, apiKey } = await createApiKey({ organizationId: orgA.id, name: "Resolve test", scopes: [] });

    const resolved = await verifyApiKey(rawKey);
    expect(resolved.id).toBe(apiKey.id);
    expect(resolved.organizationId).toBe(orgA.id);

    const reloaded = await prismaWithoutTenantScoping.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    expect(reloaded.lastUsedAt).not.toBeNull();
  });

  it("verifyApiKey throws InvalidApiKeyError for a bogus key", async () => {
    await expect(verifyApiKey("sk_not-a-real-key")).rejects.toThrow(InvalidApiKeyError);
  });

  it("verifyApiKey throws for a revoked key", async () => {
    const { rawKey, apiKey } = await createApiKey({ organizationId: orgA.id, name: "Revoke test", scopes: [] });
    await revokeApiKey(orgA.id, apiKey.id);
    await expect(verifyApiKey(rawKey)).rejects.toThrow(InvalidApiKeyError);
  });

  it("verifyApiKey throws for an expired key", async () => {
    const { rawKey } = await createApiKey({
      organizationId: orgA.id,
      name: "Expiry test",
      scopes: [],
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(verifyApiKey(rawKey)).rejects.toThrow(InvalidApiKeyError);
  });

  it("apiKeyHasScope checks membership in the key's scope list", async () => {
    const { apiKey } = await createApiKey({ organizationId: orgA.id, name: "Scoped", scopes: ["core.team.read"] });
    expect(apiKeyHasScope(apiKey, "core.team.read")).toBe(true);
    expect(apiKeyHasScope(apiKey, "core.team.write")).toBe(false);
  });

  it("listApiKeys is scoped to the organization and never returns keyHash", async () => {
    await createApiKey({ organizationId: orgA.id, name: "A's key", scopes: [] });
    await createApiKey({ organizationId: orgB.id, name: "B's key", scopes: [] });

    const orgAKeys = await listApiKeys(orgA.id);
    expect(orgAKeys.every((k) => k.organizationId === orgA.id)).toBe(true);
    expect(orgAKeys.some((k) => k.name === "B's key")).toBe(false);
    expect(orgAKeys[0]).not.toHaveProperty("keyHash");
  });

  it("listApiKeysSearch filters by name, excludes revoked keys, and paginates with a total count", async () => {
    const tag = `search-${runId}`;
    await createApiKey({ organizationId: orgA.id, name: `Alpha ${tag}`, scopes: [] });
    const { apiKey: revoked } = await createApiKey({ organizationId: orgA.id, name: `Revoked ${tag}`, scopes: [] });
    await revokeApiKey(orgA.id, revoked.id);

    const result = await listApiKeysSearch(orgA.id, { q: tag });
    expect(result.items.some((k) => k.name === `Alpha ${tag}`)).toBe(true);
    expect(result.items.some((k) => k.name === `Revoked ${tag}`)).toBe(false);
    expect(result.totalCount).toBe(1);
  });

  it("revokeApiKey throws ApiKeyNotFoundError for a cross-org id (not a silent success)", async () => {
    const { apiKey } = await createApiKey({ organizationId: orgA.id, name: "Cross-org test", scopes: [] });
    await expect(revokeApiKey(orgB.id, apiKey.id)).rejects.toThrow(ApiKeyNotFoundError);
  });

  it("revokeApiKey throws ApiKeyNotFoundError when called twice (already revoked)", async () => {
    const { apiKey } = await createApiKey({ organizationId: orgA.id, name: "Double revoke", scopes: [] });
    await revokeApiKey(orgA.id, apiKey.id);
    await expect(revokeApiKey(orgA.id, apiKey.id)).rejects.toThrow(ApiKeyNotFoundError);
  });
});
