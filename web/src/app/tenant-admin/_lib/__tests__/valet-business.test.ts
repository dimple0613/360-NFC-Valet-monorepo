import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../../../../lib/db";
import {
  assignCardToProperty,
  createDeckCards,
  createDriver,
  createLocation,
  createOffer,
  deleteOffer,
  getDashboardData,
  getDriverDetail,
  getDrivers,
  getOffers,
  getQueueOrders,
  getReports,
  listCardsForTable,
  listOffersForTable,
  markCardDefect,
  markCardPrinted,
  removeCard,
  removeDriver,
  resetDriverPassword,
  setCardStatus,
  setOfferState,
  toggleDriverShift,
  unassignCard,
  updateDriver,
  updateOffer,
} from "@/app/tenant-admin/_lib/valet-data";
import { verifyPassword } from "@/app/tenant-admin/_lib/valet-auth";

// M8 "monorepo tests for merged valet business code": the merged single-DB
// valet services (offers, drivers, cards, queue, dashboard, reports) had zero
// test coverage. These are happy-path/lifecycle tests seeded against the same
// DB the routes use (the M4 suite covers cross-tenant isolation probes). Each
// describe seeds its own org so the suites never interfere.
const runId = Date.now().toString(36);

describe("offers business logic (M8)", () => {
  let org: { id: string };
  let propId: number;
  let offerId: number;

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: `M8 Offers Org ${runId}`, slug: `m8-offers-${runId}` },
    });
    const loc = await createLocation({ name: `M8 Offers Prop ${runId}`, slots: 5 }, org.id);
    propId = loc.id;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.offer.deleteMany({ where: { propertyId: propId } });
    await prismaWithoutTenantScoping.zone.deleteMany({ where: { propertyId: propId } });
    await prismaWithoutTenantScoping.property.delete({ where: { id: propId } }).catch(() => undefined);
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  });

  it("createOffer binds to the org property and defaults live + validatesValet", async () => {
    const created = await createOffer({ title: `M8 Steak ${runId}`, price: 120, category: "Dining", propertyId: propId }, org.id);
    offerId = created.id;
    const row = await prismaWithoutTenantScoping.offer.findUnique({ where: { id: offerId } });
    expect(row!.live).toBe(true);
    expect(row!.validatesValet).toBe(true);
    expect(Number(row!.price)).toBe(120);
    expect(row!.category).toBe("Dining");
  });

  it("listOffersForTable reflects the created offer, and getOffers is org-scoped", async () => {
    const list = await listOffersForTable({ organizationId: org.id, page: 1, pageSize: 20, sortBy: "", sortDir: "asc", status: "all", property: "all", q: "" });
    const mine = list.items.find((o) => o.id === offerId);
    expect(mine).toBeDefined();
    expect(mine!.live).toBe(true);

    const all = await getOffers({ organizationId: org.id });
    expect(all.offers.map((o) => o.id)).toContain(offerId);
    expect(all.offers.every((o) => o.propertyId === propId)).toBe(true);
  });

  it("updateOffer changes fields and the list reflects them", async () => {
    await updateOffer(offerId, { title: `M8 Steak v2 ${runId}`, price: 140, category: "Brunch", desc: "updated" }, org.id);
    const list = await listOffersForTable({ organizationId: org.id, page: 1, pageSize: 20, sortBy: "", sortDir: "asc", status: "all", property: "all", q: "" });
    const mine = list.items.find((o) => o.id === offerId)!;
    expect(mine.title).toBe(`M8 Steak v2 ${runId}`);
    expect(mine.price).toBe(140);
    expect(mine.category).toBe("Brunch");
  });

  it("setOfferState toggles live/draft and unfeatures the whole org when a new one is featured", async () => {
    const second = await createOffer({ title: `M8 Featured ${runId}`, price: 60, propertyId: propId }, org.id);
    await setOfferState(offerId, { featured: 1 }, org.id);
    await setOfferState(second.id, { featured: 1 }, org.id);

    const a = await prismaWithoutTenantScoping.offer.findUnique({ where: { id: offerId } });
    const b = await prismaWithoutTenantScoping.offer.findUnique({ where: { id: second.id } });
    expect(a!.featured).toBeNull();
    expect(b!.featured).toBe(1);

    await setOfferState(offerId, { live: false, draft: true }, org.id);
    const after = await prismaWithoutTenantScoping.offer.findUnique({ where: { id: offerId } });
    expect(after!.live).toBe(false);
    expect(after!.draft).toBe(true);
    await prismaWithoutTenantScoping.offer.delete({ where: { id: second.id } });
  });

  it("setOfferState on an unknown id throws Offer not found", async () => {
    await expect(setOfferState(999999999, { live: true }, org.id)).rejects.toThrow("Offer not found");
  });

  it("deleteOffer removes it from the org list", async () => {
    await deleteOffer(offerId, org.id);
    const all = await getOffers({ organizationId: org.id });
    expect(all.offers.map((o) => o.id)).not.toContain(offerId);
  });
});

describe("drivers business logic (M8)", () => {
  let org: { id: string };
  let propId: number;
  let driverId: number;

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: `M8 Drivers Org ${runId}`, slug: `m8-drivers-${runId}` },
    });
    const loc = await createLocation({ name: `M8 Drivers Prop ${runId}`, slots: 5 }, org.id);
    propId = loc.id;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.driverShift.deleteMany({ where: { driverId } });
    await prismaWithoutTenantScoping.driver.deleteMany({ where: { id: driverId, status: "removed" } }).catch(() => undefined);
    await prismaWithoutTenantScoping.zone.deleteMany({ where: { propertyId: propId } });
    await prismaWithoutTenantScoping.property.delete({ where: { id: propId } }).catch(() => undefined);
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  });

  it("createDriver hashes the password and appears in getDrivers", async () => {
    const created = await createDriver(
      { name: `M8 Rider ${runId}`, propertyId: propId, email: `m8-${runId}@test.local`, phone: "+971501234567", password: "Secret#123" },
      org.id
    );
    driverId = created.id;
    const row = await prismaWithoutTenantScoping.driver.findUnique({ where: { id: driverId } });
    expect(verifyPassword("Secret#123", row!.passwordHash)).toBe(true);
    expect(verifyPassword("wrong", row!.passwordHash)).toBe(false);
    expect(row!.status).toBe("off_duty");

    const res = await getDrivers({ organizationId: org.id });
    expect(res.drivers.map((d) => d.id)).toContain(driverId);
  });

  it("toggleDriverShift on opens a shift and flips status; off closes it", async () => {
    await toggleDriverShift(driverId, true, org.id);
    let row = await prismaWithoutTenantScoping.driver.findUnique({ where: { id: driverId } });
    expect(row!.status).toBe("on_shift");
    let shifts = await prismaWithoutTenantScoping.driverShift.findMany({ where: { driverId, endedAt: null } });
    expect(shifts.length).toBe(1);

    await toggleDriverShift(driverId, false, org.id);
    row = await prismaWithoutTenantScoping.driver.findUnique({ where: { id: driverId } });
    expect(row!.status).toBe("off_duty");
    shifts = await prismaWithoutTenantScoping.driverShift.findMany({ where: { driverId } });
    expect(shifts.every((s) => s.endedAt !== null)).toBe(true);
  });

  it("re-opening a shift after a stale open one leaves exactly one live row", async () => {
    await toggleDriverShift(driverId, true, org.id);
    await toggleDriverShift(driverId, true, org.id); // simulates a crashed session
    const live = await prismaWithoutTenantScoping.driverShift.findMany({ where: { driverId, endedAt: null } });
    expect(live.length).toBe(1);
    await toggleDriverShift(driverId, false, org.id);
  });

  it("resetDriverPassword rotates the stored hash", async () => {
    await resetDriverPassword(driverId, "New#Pass456", org.id);
    const row = await prismaWithoutTenantScoping.driver.findUnique({ where: { id: driverId } });
    expect(verifyPassword("New#Pass456", row!.passwordHash)).toBe(true);
    expect(verifyPassword("Secret#123", row!.passwordHash)).toBe(false);
  });

  it("updateDriver changes the name visible in getDriverDetail", async () => {
    await updateDriver(driverId, { name: `M8 Rider Renamed ${runId}`, propertyId: propId }, org.id);
    const d = await getDriverDetail(driverId, org.id, { from: "", to: "", page: 1, pageSize: 10, property: "all" });
    expect(d.driver.name).toBe(`M8 Rider Renamed ${runId}`);
  });

  it("removeDriver soft-deletes (status removed) and lowers the dashboard on-shift count via prior closes", async () => {
    await toggleDriverShift(driverId, true, org.id);
    await removeDriver(driverId, org.id);
    const row = await prismaWithoutTenantScoping.driver.findUnique({ where: { id: driverId } });
    expect(row!.status).toBe("removed");
    const shifts = await prismaWithoutTenantScoping.driverShift.findMany({ where: { driverId, endedAt: null } });
    expect(shifts.length).toBe(0);
  });
});

describe("cards business logic (#48 deck)", () => {
  let org: { id: string };
  let propId: number;
  let firstCard: { id: number; uid: string } | null = null;
  const createdCardIds: number[] = [];

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: `M8 Cards Org ${runId}`, slug: `m8-cards-${runId}` },
    });
    const loc = await createLocation({ name: `M8 Cards Prop ${runId}`, slots: 5 }, org.id);
    propId = loc.id;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.nfcCard.deleteMany({ where: { id: { in: createdCardIds } } });
    await prismaWithoutTenantScoping.nfcCard.deleteMany({ where: { propertyId: propId } });
    await prismaWithoutTenantScoping.zone.deleteMany({ where: { propertyId: propId } });
    await prismaWithoutTenantScoping.property.delete({ where: { id: propId } }).catch(() => undefined);
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  });

  it("createDeckCards mints an assigned batch from the deck series when bound to a property", async () => {
    const batch = await createDeckCards({ count: 3, propertyId: propId, organizationId: org.id });
    expect(batch.created).toBe(3);
    expect(batch.propertyId).toBe(propId);
    expect(batch.from < batch.to).toBe(true);

    const rows = await prismaWithoutTenantScoping.nfcCard.findMany({
      where: { uid: { gte: batch.from, lte: batch.to } },
    });
    expect(rows.length).toBe(3);
    createdCardIds.push(...rows.map((r) => r.id));
    firstCard = rows[0];

    const list = await listCardsForTable({ organizationId: org.id, page: 1, pageSize: 50, sortBy: "", sortDir: "asc", status: "all", property: "all", q: "" });
    const mine = list.items.filter((c) => c.uid >= batch.from && c.uid <= batch.to);
    expect(mine.length).toBe(3);
    expect(mine.every((c) => c.status === "assigned")).toBe(true);
    expect(mine.every((c) => c.propertyId === propId)).toBe(true);
    expect(mine.every((c) => c.printsCount === 0)).toBe(true);
  });

  it("setCardStatus block/unblock/lost drive the stored status", async () => {
    expect(firstCard).not.toBeNull();
    const card = firstCard!;
    await setCardStatus(card.id, "block", org.id);
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: card.id } }))!.status).toBe("blocked");
    await setCardStatus(card.id, "unblock", org.id);
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: card.id } }))!.status).toBe("ready");
    await setCardStatus(card.id, "block", org.id);
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: card.id } }))!.status).toBe("blocked");
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: card.id } }))!.lostAt).not.toBeNull();
  });

  it("assign/unassign/print lifecycle: freeze + defect guard every mutation", async () => {
    const deck = await createDeckCards({ count: 2, organizationId: org.id });
    const cards = await prismaWithoutTenantScoping.nfcCard.findMany({
      where: { uid: { in: [deck.from, deck.to] } },
    });
    expect(cards.length).toBe(2);
    createdCardIds.push(...cards.map((r) => r.id));
    const [c1, c2] = cards;

    // minted without a property → unassigned deck inventory
    expect(c1.status).toBe("unassigned");
    expect(c1.propertyId).toBeNull();

    // org assign option: unassigned → assigned to its own property
    await assignCardToProperty(c1.uid, propId, org.id);
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: c1.id } }))!.status).toBe("assigned");
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: c1.id } }))!.propertyId).toBe(propId);

    // unassign returns the card to the deck
    await unassignCard(c1.uid, org.id);
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: c1.id } }))!.status).toBe("unassigned");
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: c1.id } }))!.propertyId).toBeNull();

    // printing freezes UID + property and records the print
    await markCardPrinted(c1.uid, "test-user-123");
    const printed = (await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: c1.id } }))!;
    expect(printed.status).toBe("printed");
    expect(printed.printsCount).toBe(1);
    expect(printed.printedBy).toBe("test-user-123");
    expect(printed.printedAt).not.toBeNull();

    // frozen: assign/unassign/remove all reject on a printed card
    await expect(assignCardToProperty(c1.uid, propId, org.id)).rejects.toThrow(/frozen/);
    await expect(unassignCard(c1.uid, org.id)).rejects.toThrow(/frozen/);
    await expect(removeCard(c1.id, org.id)).rejects.toThrow(/Only unassigned, assigned or defect/);

    // defect retires the other card; printed cards keep their history
    await markCardDefect(c2.uid);
    expect((await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: c2.id } }))!.status).toBe("defect");
    // Deck defect cards are platform inventory — remove as super admin (no orgId).
    await removeCard(c2.id);
    expect(await prismaWithoutTenantScoping.nfcCard.findUnique({ where: { id: c2.id } })).toBeNull();
  });
});

describe("queue + dashboard + reports aggregation (M8)", () => {
  let org: { id: string };
  let propId: number;
  let orderId: number;
  const plate = `M8A ${runId}`;

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: `M8 QDR Org ${runId}`, slug: `m8-qdr-${runId}` },
    });
    const loc = await createLocation({ name: `M8 QDR Prop ${runId}`, slots: 5 }, org.id);
    propId = loc.id;
    const order = await prismaWithoutTenantScoping.order.create({ data: { propertyId: propId, plate, status: "parked" } });
    orderId = order.id;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.order.delete({ where: { id: orderId } }).catch(() => undefined);
    await prismaWithoutTenantScoping.zone.deleteMany({ where: { propertyId: propId } });
    await prismaWithoutTenantScoping.property.delete({ where: { id: propId } }).catch(() => undefined);
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  });

  it("getQueueOrders returns the org-scoped active order and its plate", async () => {
    const res = await getQueueOrders({ organizationId: org.id, page: 1, pageSize: 20, days: 1, status: "active", sort: "createdAt", dir: "desc" });
    const found = res.orders.find((o) => o.id === orderId);
    expect(found).toBeDefined();
    expect(found!.plate).toBe(plate);
  });

  it("getDashboardData aggregates stats and stays scoped to the org property", async () => {
    const dash = await getDashboardData(7, null, org.id);
    expect(dash.stats).toMatchObject({
      carsParked: expect.any(Number),
      avgReturnTime: expect.any(Number),
      offersValidated: expect.any(Number),
      outletSpend: expect.any(Number),
      driversOnShift: expect.any(Number),
      driversTotal: expect.any(Number),
      overdue: expect.any(Number),
    });
    expect(dash.byProperty.map((p) => p.id)).toContain(propId);
    expect(dash.properties.map((p) => p.id)).toContain(propId);
    expect(dash.byProperty.every((p) => p.id === propId)).toBe(true);
  });

  it("getReports returns one row per requested day with numeric metrics", async () => {
    const reports = await getReports({ days: 3, organizationId: org.id });
    expect(reports.rows.length).toBe(3);
    for (const r of reports.rows) {
      expect(typeof r.dropOffs).toBe("number");
      expect(typeof r.returns).toBe("number");
      expect(typeof r.spend).toBe("number");
      expect(typeof r.validations).toBe("number");
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});