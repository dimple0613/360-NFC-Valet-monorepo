import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../../../../lib/db";
import {
  assignCardToProperty,
  createDeckCards,
  getDrivers,
  getLocations,
  getOffers,
  getQueueOrders,
  listCardsForTable,
  listDriversForTable,
  listOffersForTable,
  createDriver,
  createOffer,
  createLocation,
  deleteLocation,
  deleteOffer,
  removeCard,
  removeDriver,
  setCardStatus,
  setOfferState,
  toggleDriverShift,
  updateDriver,
  updateLocation,
  updateOffer,
  updateOrderCondition,
} from "@/app/tenant-admin/_lib/valet-data";

// M4 "API 404 probe pass": the valet data layer is the tenant-isolation
// enforcement point the /api/platform/valet/* routes sit on top of. Every
// cross-tenant access must behave exactly like a missing id — the mutators
// throw "<Label> not found" (routes translate that to 404; see the catch
// clauses in api/platform/valet/offers/route.ts) and lists must never surface
// another org's rows. This suite seeds two orgs with parallel valet rows and
// proves the isolation, so the route-level 404 behavior is exercised back to
// the layer that actually enforces it (not a div-ergent UI/route-only check).
describe("valet cross-tenant isolation (M4)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let propA: { id: number; name: string };
  let propB: { id: number; name: string };
  let offerA: { id: number };
  let offerB: { id: number };
  let offerATitle = "";
  let offerBTitle = "";
  let driverA: { id: number; valetId: string; name: string };
  let driverB: { id: number; valetId: string; name: string };
  let cardA: { id: number; uid: string };
  let cardB: { id: number; uid: string };
  let orderA: { id: number };
  let orderB: { id: number };

  const runId = Date.now().toString(36);

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: `M4 Org A ${runId}`, slug: `m4-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: `M4 Org B ${runId}`, slug: `m4-org-b-${runId}` },
    });

    propA = await createLocation({ name: `M4 Prop A ${runId}` }, orgA.id);
    propB = await createLocation({ name: `M4 Prop B ${runId}` }, orgB.id);

    offerATitle = `M4 Offer A ${runId}`;
    offerBTitle = `M4 Offer B ${runId}`;
    offerA = await createOffer({ title: offerATitle, price: 10, category: "Dining", propertyId: propA.id }, orgA.id);
    offerB = await createOffer({ title: offerBTitle, price: 20, category: "Dining", propertyId: propB.id }, orgB.id);

    const a1 = await createDriver({ name: `M4 Driver A1 ${runId}`, propertyId: propA.id, email: `m4a1-${runId}@test.local`, password: "Probe#123" }, orgA.id);
    const b1 = await createDriver({ name: `M4 Driver B1 ${runId}`, propertyId: propB.id, email: `m4b1-${runId}@test.local`, password: "Probe#123" }, orgB.id);
    driverA = a1;
    driverB = b1;

    const ra = await createDeckCards({ count: 1, propertyId: propA.id, organizationId: orgA.id });
    const rb = await createDeckCards({ count: 1, propertyId: propB.id, organizationId: orgB.id });
    cardA = { id: 0, uid: ra.from };
    cardB = { id: 0, uid: rb.from };
    const cards = await prismaWithoutTenantScoping.nfcCard.findMany({
      where: { uid: { in: [ra.from, rb.from] } },
      select: { id: true, uid: true },
    });
    cardA = cards.find((c) => c.uid === ra.from)! as typeof cardA;
    cardB = cards.find((c) => c.uid === rb.from)! as typeof cardB;

    const oa = await prismaWithoutTenantScoping.order.create({ data: { propertyId: propA.id, plate: `M4A ${runId}`, status: "active" } });
    const ob = await prismaWithoutTenantScoping.order.create({ data: { propertyId: propB.id, plate: `M4B ${runId}`, status: "active" } });
    orderA = { id: oa.id };
    orderB = { id: ob.id };
  });

  afterAll(async () => {
    const propIds = [propA.id, propB.id];
    const driverIds = [driverA.id, driverB.id];
    const cardIds = [cardA.id, cardB.id];
    await prismaWithoutTenantScoping.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id] } } });
    await prismaWithoutTenantScoping.offer.deleteMany({ where: { id: { in: [offerA.id, offerB.id] } } });
    await prismaWithoutTenantScoping.nfcCard.deleteMany({ where: { id: { in: cardIds } } });
    await prismaWithoutTenantScoping.driverShift.deleteMany({ where: { driverId: { in: driverIds } } });
    await prismaWithoutTenantScoping.driver.deleteMany({ where: { id: { in: driverIds } } });
    await prismaWithoutTenantScoping.zone.deleteMany({ where: { propertyId: { in: propIds } } });
    await prismaWithoutTenantScoping.property.deleteMany({ where: { id: { in: propIds } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  describe("mutators: cross-tenant id behaves like a missing id (→ 404)", () => {
    it("offers: update/setState/delete throw Offer not found for B's id under org A", async () => {
      await expect(updateOffer(offerB.id, { title: "x", price: 1 }, orgA.id)).rejects.toThrow("Offer not found");
      await expect(setOfferState(offerB.id, { featured: 1 }, orgA.id)).rejects.toThrow("Offer not found");
      await expect(deleteOffer(offerB.id, orgA.id)).rejects.toThrow("Offer not found");
    });

    it("offers: create under A cannot target B's property", async () => {
      await expect(createOffer({ title: "x", price: 1, propertyId: propB.id }, orgA.id)).rejects.toThrow("Property not found");
    });

    it("drivers: update/toggle/remove throw Driver not found for B's id under org A", async () => {
      await expect(updateDriver(driverB.id, { name: "x" }, orgA.id)).rejects.toThrow("Driver not found");
      await expect(toggleDriverShift(driverB.id, true, orgA.id)).rejects.toThrow("Driver not found");
      await expect(removeDriver(driverB.id, orgA.id)).rejects.toThrow("Driver not found");
    });

    it("drivers: create under A cannot target B's property", async () => {
      await expect(createDriver({ name: "x", propertyId: propB.id, password: "Probe#123" }, orgA.id)).rejects.toThrow("Property not found");
    });

    it("cards: setStatus/assign/remove throw Card not found for B's card under org A", async () => {
      await expect(setCardStatus(cardB.id, "block", orgA.id)).rejects.toThrow("Card not found");
      await expect(assignCardToProperty(cardB.uid, propA.id, orgA.id)).rejects.toThrow("Card not found");
      await expect(removeCard(cardB.id, orgA.id)).rejects.toThrow("Card not found");
    });

    it("cards: createDeckCards under A cannot bind to B's property", async () => {
      await expect(createDeckCards({ count: 1, propertyId: propB.id, organizationId: orgA.id })).rejects.toThrow(
        "Property doesn't belong to this organization."
      );
    });

    it("locations: update/delete throw Location not found for B's property under org A", async () => {
      await expect(updateLocation(propB.id, { name: "x" }, orgA.id)).rejects.toThrow("Location not found");
      await expect(deleteLocation(propB.id, orgA.id)).rejects.toThrow("Location not found");
    });

    it("orders: updateCondition throws Order not found for B's order under org A", async () => {
      await expect(
        updateOrderCondition({ organizationId: orgA.id, orderId: orderB.id, condition: { damage: [], mileageKm: null, notes: null }, updatedBy: "probe" })
      ).rejects.toThrow("Order not found");
    });
  });

  describe("lists: org scoping never leaks across orgs", () => {
    it("getLocations under A returns only A's property", async () => {
      const res = await getLocations(orgA.id);
      const names = res.properties.map((p) => p.name);
      expect(names).toContain(propA.name);
      expect(names).not.toContain(propB.name);
    });

    it("listOffersForTable under A returns only A's offer", async () => {
      const res = await listOffersForTable({ organizationId: orgA.id, page: 1, pageSize: 20, sortBy: "", sortDir: "asc", status: "all", property: "all", q: "" });
      const titles = res.items.map((o) => o.title);
      expect(titles).toContain(offerATitle);
      expect(titles).not.toContain(offerBTitle);
      expect(res.totalCount).toBeLessThan(10);
    });

    it("getOffers under A returns only A's offer", async () => {
      const res = await getOffers({ organizationId: orgA.id });
      expect(res.offers.map((o) => o.id)).toContain(offerA.id);
      expect(res.offers.map((o) => o.id)).not.toContain(offerB.id);
    });

    it("getDrivers under A returns only A's driver", async () => {
      const res = await getDrivers({ organizationId: orgA.id });
      expect(res.drivers.map((d) => d.valetId)).toContain(driverA.valetId);
      expect(res.drivers.map((d) => d.valetId)).not.toContain(driverB.valetId);
    });

    it("listDriversForTable under A returns only A's driver", async () => {
      const res = await listDriversForTable({ organizationId: orgA.id, page: 1, pageSize: 20, sortBy: "", sortDir: "asc", status: "all", property: "all", q: "" });
      expect(res.items.map((d) => d.valetId)).toContain(driverA.valetId);
      expect(res.items.map((d) => d.valetId)).not.toContain(driverB.valetId);
    });

    it("listCardsForTable under A returns only A's card", async () => {
      // The org's list also shows the shared platform deck (property_id IS
      // NULL), so a small page can fill with deck junk and hide cardA — use a
      // big page so the assertion is about scoping, not list size.
      const res = await listCardsForTable({ organizationId: orgA.id, page: 1, pageSize: 100, sortBy: "", sortDir: "asc", status: "all", property: "all", q: "" });
      expect(res.items.map((c) => c.uid)).toContain(cardA.uid);
      expect(res.items.map((c) => c.uid)).not.toContain(cardB.uid);
    });

    it("getQueueOrders under A returns only A's order", async () => {
      const res = await getQueueOrders({ organizationId: orgA.id, page: 1, pageSize: 20, days: 1, status: "all", sort: "createdAt", dir: "desc" });
      expect(res.orders.map((o) => o.id)).toContain(orderA.id);
      expect(res.orders.map((o) => o.id)).not.toContain(orderB.id);
    });
  });

  describe("same-org control: the same operations succeed inside A", () => {
    it("setOfferState on A's own offer works", async () => {
      await expect(setOfferState(offerA.id, { featured: 1 }, orgA.id)).resolves.toBeUndefined();
    });

    it("updateLocation on A's own property works", async () => {
      await expect(updateLocation(propA.id, { name: propA.name }, orgA.id)).resolves.toMatchObject({ id: propA.id });
    });
  });
});