import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDraftInvoice, createPlanVersion, createSubscription, issueInvoice, prismaWithoutTenantScoping, registerResourceTypes } from "@saasclaude/db";
import { GET as GET_PLANS } from "../billing/plans/route";
import { GET as GET_SUBSCRIPTION } from "../billing/subscription/route";
import { GET as GET_INVOICES } from "../billing/invoices/route";
import { GET as GET_INVOICE } from "../billing/invoices/[id]/route";
import { GET as GET_USAGE } from "../billing/usage/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

const runId = Date.now().toString(36);
const publicPlanKey = `rest-billing-public-${runId}`;
const hiddenPlanKey = `rest-billing-hidden-${runId}`;
const usageResourceKey = `rest-billing-usage-${runId}.seats`;
const usagePlanKey = `rest-billing-usage-plan-${runId}`;

describe("/api/v1/billing", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let readKey: string;
  let noScopeKey: string;
  let issuedInvoice: { id: string };

  beforeAll(async () => {
    org = await seedOrganization("REST Billing Org");
    otherOrg = await seedOrganization("REST Billing Other Org");
    readKey = (await seedApiKey(org.id, ["core.billing.read"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;

    await createPlanVersion({ key: publicPlanKey, name: "Public Plan", type: "MONTHLY", visibility: "PUBLIC" });
    await createPlanVersion({ key: hiddenPlanKey, name: "Hidden Plan", type: "MONTHLY", visibility: "HIDDEN" });
    await createSubscription({ organizationId: org.id, planKey: publicPlanKey });

    const draft = await createDraftInvoice({
      organizationId: org.id,
      lineItems: [{ description: "Public Plan", unitAmountCents: 2900 }],
    });
    issuedInvoice = await issueInvoice(org.id, draft.id);
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.invoiceLineItem.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.invoice.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.planResource.deleteMany({ where: { plan: { key: { in: [publicPlanKey, hiddenPlanKey] } } } });
    await prismaWithoutTenantScoping.planFeature.deleteMany({ where: { plan: { key: { in: [publicPlanKey, hiddenPlanKey] } } } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: { in: [publicPlanKey, hiddenPlanKey] } } });
  });

  describe("GET /billing/plans", () => {
    it("401s with no key", async () => {
      expect((await GET_PLANS(apiRequest("/billing/plans"), {})).status).toBe(401);
    });

    it("403s without core.billing.read", async () => {
      expect((await GET_PLANS(apiRequest("/billing/plans", { token: noScopeKey }), {})).status).toBe(403);
    });

    it("200s listing only PUBLIC plans", async () => {
      const res = await GET_PLANS(apiRequest("/billing/plans", { token: readKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { plans: { key: string }[] };
      expect(body.plans.some((p) => p.key === publicPlanKey)).toBe(true);
      expect(body.plans.some((p) => p.key === hiddenPlanKey)).toBe(false);
    });
  });

  describe("GET /billing/subscription", () => {
    it("401s with no key", async () => {
      expect((await GET_SUBSCRIPTION(apiRequest("/billing/subscription"), {})).status).toBe(401);
    });

    it("200s with the org's active subscription", async () => {
      const res = await GET_SUBSCRIPTION(apiRequest("/billing/subscription", { token: readKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { subscription: { planKey: string } | null };
      expect(body.subscription?.planKey).toBe(publicPlanKey);
    });

    it("200s with null when the org has no subscription", async () => {
      const key = (await seedApiKey(otherOrg.id, ["core.billing.read"])).rawKey;
      const res = await GET_SUBSCRIPTION(apiRequest("/billing/subscription", { token: key }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { subscription: unknown };
      expect(body.subscription).toBeNull();
    });
  });

  describe("GET /billing/invoices", () => {
    it("401s with no key", async () => {
      expect((await GET_INVOICES(apiRequest("/billing/invoices"), {})).status).toBe(401);
    });

    it("403s without core.billing.read", async () => {
      expect((await GET_INVOICES(apiRequest("/billing/invoices", { token: noScopeKey }), {})).status).toBe(403);
    });

    it("200s listing the org's own invoices only", async () => {
      const res = await GET_INVOICES(apiRequest("/billing/invoices", { token: readKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { invoices: { id: string }[] };
      expect(body.invoices.some((i) => i.id === issuedInvoice.id)).toBe(true);
    });
  });

  describe("GET /billing/invoices/:id", () => {
    it("401s with no key", async () => {
      const res = await GET_INVOICE(apiRequest(`/billing/invoices/${issuedInvoice.id}`), routeCtx({ id: issuedInvoice.id }));
      expect(res.status).toBe(401);
    });

    it("404s for an unknown id", async () => {
      const res = await GET_INVOICE(
        apiRequest("/billing/invoices/nope", { token: readKey }),
        routeCtx({ id: "nope" }),
      );
      expect(res.status).toBe(404);
    });

    it("404s for another org's invoice (FR-104)", async () => {
      const key = (await seedApiKey(otherOrg.id, ["core.billing.read"])).rawKey;
      const res = await GET_INVOICE(
        apiRequest(`/billing/invoices/${issuedInvoice.id}`, { token: key }),
        routeCtx({ id: issuedInvoice.id }),
      );
      expect(res.status).toBe(404);
    });

    it("200s with the real invoice + line items", async () => {
      const res = await GET_INVOICE(
        apiRequest(`/billing/invoices/${issuedInvoice.id}`, { token: readKey }),
        routeCtx({ id: issuedInvoice.id }),
      );
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { id: string; totalCents: number; lineItems: unknown[] };
      expect(body.id).toBe(issuedInvoice.id);
      expect(body.totalCents).toBe(2900);
      expect(body.lineItems).toHaveLength(1);
    });
  });

  describe("GET /billing/usage", () => {
    // Own dedicated org, not the shared `org` above — a second subscription
    // on the shared org would become its new "most recent" active
    // subscription and silently break the GET /billing/subscription
    // assertions above, which expect publicPlanKey specifically.
    let usageOrg: { id: string };
    let usageReadKey: string;

    beforeAll(async () => {
      usageOrg = await seedOrganization("REST Billing Usage Org");
      usageReadKey = (await seedApiKey(usageOrg.id, ["core.billing.read"])).rawKey;
      await registerResourceTypes([
        {
          key: usageResourceKey,
          module: `rest-billing-usage-${runId}`,
          displayName: "Seats",
          unit: "seats",
          aggregation: "GAUGE",
          resetCycle: "NEVER",
          overagePolicy: "BLOCK",
        },
      ]);
      await createPlanVersion({
        key: usagePlanKey,
        name: "Usage Plan",
        type: "MONTHLY",
        resources: [{ resourceTypeKey: usageResourceKey, limit: 5 }],
      });
      await createSubscription({ organizationId: usageOrg.id, planKey: usagePlanKey });
    });

    afterAll(async () => {
      await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: usageOrg.id } });
      await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: usageOrg.id } });
      await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: usageOrg.id } });
      await prismaWithoutTenantScoping.planResource.deleteMany({ where: { plan: { key: usagePlanKey } } });
      await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: usagePlanKey } });
    });

    it("401s with no key", async () => {
      expect((await GET_USAGE(apiRequest("/billing/usage"), {})).status).toBe(401);
    });

    it("403s without core.billing.read", async () => {
      const key = (await seedApiKey(usageOrg.id, ["core.organization.read"])).rawKey;
      expect((await GET_USAGE(apiRequest("/billing/usage", { token: key }), {})).status).toBe(403);
    });

    it("200s with used/limit/unit/overagePolicy resolved from the org's active subscription", async () => {
      const res = await GET_USAGE(apiRequest("/billing/usage", { token: usageReadKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { usage: { resourceTypeKey: string; unit: string; used: number; limit: number | null; overagePolicy: string }[] };
      const entry = body.usage.find((u) => u.resourceTypeKey === usageResourceKey);
      expect(entry).toEqual({ resourceTypeKey: usageResourceKey, unit: "seats", used: 0, limit: 5, overagePolicy: "BLOCK" });
    });
  });
});
