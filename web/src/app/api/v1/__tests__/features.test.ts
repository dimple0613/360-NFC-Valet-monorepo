import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping, registerFeatures, setOrganizationFeatureOverride } from "@saasclaude/db";
import { GET } from "../features/route";
import { apiRequest, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

const runId = Date.now().toString(36);
const featureKey = `rest-features-${runId}.thing`;

describe("/api/v1/features", () => {
  let org: { id: string };
  let readKey: string;
  let noScopeKey: string;

  beforeAll(async () => {
    org = await seedOrganization("REST Features Org");
    readKey = (await seedApiKey(org.id, ["core.features.read"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;
    await registerFeatures([{ key: featureKey, module: `rest-features-${runId}`, name: "Thing", defaultEnabled: false }]);
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: org.id } });
    await prismaWithoutTenantScoping.feature.deleteMany({ where: { key: featureKey } });
  });

  it("401s with no key", async () => {
    expect((await GET(apiRequest("/features"), {})).status).toBe(401);
  });

  it("403s without core.features.read", async () => {
    expect((await GET(apiRequest("/features", { token: noScopeKey }), {})).status).toBe(403);
  });

  it("200s with the default-disabled feature absent from enabled", async () => {
    const res = await GET(apiRequest("/features", { token: readKey }), {});
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { enabled: string[] };
    expect(body.enabled).not.toContain(featureKey);
  });

  it("reflects a real organization-level override", async () => {
    await setOrganizationFeatureOverride(org.id, featureKey, true);

    const res = await GET(apiRequest("/features", { token: readKey }), {});
    const body = (await jsonOf(res)) as { enabled: string[] };
    expect(body.enabled).toContain(featureKey);
  });
});
