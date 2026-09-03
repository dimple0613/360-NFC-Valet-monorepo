import { query, transaction } from "./db";
import { startOfDay } from "./valet-api";
import { nextUidStart } from "./uid";
import { hashPassword, makePin, makeValetId } from "./valet-auth";

type DbRow = Record<string, any>;

async function q<T extends DbRow = DbRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await query(text, params);
  return rows as T[];
}

const PROPERTY_COLORS = ["#F4531F", "#FF8A50", "#1C2B46", "#4A5FC9", "#0C9D61"];

const STATUS_LABEL: Record<string, string> = {
  on_shift: "On Shift",
  on_break: "On Break",
  off_duty: "Off Duty",
  removed: "Removed",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

async function propertiesForScope(orgId?: string | null): Promise<Array<{ id: number; name: string; area: string }>> {
  const rows = orgId
    ? await q("SELECT id, name, area FROM properties WHERE organization_id = $1 ORDER BY id", [orgId])
    : await q("SELECT id, name, area FROM properties ORDER BY id", []);
  return rows.map((r) => ({ id: r.id, name: r.name, area: r.area }));
}

export async function fieldsForDriver(orgId?: string | null): Promise<Array<{ id: number; name: string }>> {
  const props = await propertiesForScope(orgId);
  return props.map((p) => ({ id: p.id, name: p.name }));
}

export interface LiveActivity {
  id: number;
  action: string;
  kind: string;
  time: Date;
  plate: string;
  property: string;
}

export async function getDashboardData(days = 7, property: string | null = null, organizationId: string | null = null) {
  const clampedDays = Math.min(30, Math.max(1, days));
  const propertyId = property ? Number(property) : null;

  const now = new Date();
  const today = startOfDay(now);
  const start = new Date(today.getTime() - (clampedDays - 1) * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + clampedDays * 24 * 60 * 60 * 1000);

  let propClause = "";
  let valClause = "";
  let driverClause = "";
  const params: Array<string | Date | number> = [start, end];
  let pIdx = 3;
  if (organizationId) {
    params.push(organizationId);
    const orgClause = ` property_id IN (SELECT id FROM properties WHERE organization_id = $${pIdx})`;
    propClause = ` AND${orgClause}`;
    valClause = ` AND v.order_id IN (SELECT id FROM orders WHERE property_id IN (SELECT id FROM properties WHERE organization_id = $${pIdx}))`;
    driverClause = ` AND property_id IN (SELECT id FROM properties WHERE organization_id = $${pIdx})`;
    pIdx += 1;
  }
  if (propertyId) {
    params.push(propertyId);
    propClause += ` AND property_id = $${pIdx}`;
    valClause = ` AND v.order_id IN (SELECT id FROM orders WHERE property_id = $${pIdx})`;
    driverClause = ` AND property_id = $${pIdx}`;
  }

  const [statsRows, byProp, dropRows, retRows, liveRows, properties] = await Promise.all([
    q(
      `SELECT
         (SELECT COUNT(*)::int FROM orders WHERE created_at >= $1 AND created_at < $2${propClause}) AS cars_parked,
         (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (returned_at - dropped_at)) / 60))::int FROM orders
            WHERE returned_at >= $1 AND returned_at < $2 AND dropped_at IS NOT NULL${propClause}) AS avg_return_min,
         (SELECT COUNT(*)::int FROM validations v WHERE v.created_at >= $1 AND v.created_at < $2${valClause}) AS offers_validated,
         (SELECT COALESCE(SUM(amount),0)::int FROM validations v WHERE v.created_at >= $1 AND v.created_at < $2${valClause}) AS outlet_spend,
         (SELECT COUNT(*)::int FROM drivers WHERE status = 'on_shift'${driverClause}) AS drivers_on_shift,
         (SELECT COUNT(*)::int FROM drivers WHERE status != 'removed'${driverClause}) AS drivers_total,
         (SELECT COUNT(*)::int FROM orders
            WHERE status IN ('parked','retrieving')
              AND created_at >= $1 AND created_at < $2
              AND created_at < NOW() - interval '2 hours'${propClause}) AS overdue`,
      params
    ),
    q(
      `SELECT p.id, p.name, p.area, p.zones_count,
              COUNT(o.id) FILTER (WHERE o.created_at >= $1 AND o.created_at < $2) AS cars_today
       FROM properties p
       LEFT JOIN orders o ON o.property_id = p.id
       ${organizationId ? "WHERE p.organization_id = $3" : ""}
       GROUP BY p.id ORDER BY p.id`,
      organizationId ? [start, end, organizationId] : [start, end]
    ),
    q<{ h: number; c: number }>(
      `SELECT EXTRACT(HOUR FROM created_at)::int AS h, COUNT(*)::int AS c
       FROM orders WHERE created_at >= $1 AND created_at < $2${propClause} GROUP BY h`,
      params
    ),
    q<{ h: number; c: number }>(
      `SELECT EXTRACT(HOUR FROM returned_at)::int AS h, COUNT(*)::int AS c
       FROM orders WHERE returned_at >= $1 AND returned_at < $2${propClause} GROUP BY h`,
      params
    ),
    q(
      `SELECT o.id, o.plate, o.car_make, o.car_model, o.status, o.created_at, o.returned_at,
              d.full_name AS driver, p.name AS property
       FROM orders o
       JOIN drivers d ON d.id = o.driver_id
       JOIN properties p ON p.id = o.property_id
       WHERE ${organizationId ? `p.organization_id = $1` : "TRUE"}${propertyId ? ` AND o.property_id = $${organizationId ? 2 : 1}` : ""}
       ORDER BY COALESCE(o.returned_at, o.created_at) DESC LIMIT 6`,
      organizationId
        ? propertyId
          ? [organizationId, propertyId]
          : [organizationId]
        : propertyId
          ? [propertyId]
          : []
    ),
    propertiesForScope(organizationId),
  ]);

  const stats = statsRows[0];
  const prevStart = new Date(start.getTime() - clampedDays * 24 * 60 * 60 * 1000);
  const prevP = organizationId
    ? propertyId
      ? [prevStart, start, organizationId, propertyId]
      : [prevStart, start, organizationId]
    : propertyId
      ? [prevStart, start, propertyId]
      : [prevStart, start];
  const prevWhere = organizationId
    ? ` AND property_id IN (SELECT id FROM properties WHERE organization_id = $3)${propertyId ? ` AND property_id = $4` : ""}`
    : propertyId
      ? ` AND property_id = $3`
      : "";
  const [prevRow] = await q<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM orders WHERE created_at >= $1 AND created_at < $2${prevWhere}`,
    prevP
  );
  const prevCarsParked = Number(prevRow.c);
  const maxCars = Math.max(...byProp.map((p) => Number(p.cars_today)), 1);

  const byProperty = byProp.map((p, i) => ({
    id: p.id,
    name: p.name,
    area: p.area,
    carsToday: Number(p.cars_today),
    color: PROPERTY_COLORS[i % PROPERTY_COLORS.length],
  }));

  const dropMap = new Map(dropRows.map((r) => [Number(r.h), r.c]));
  const retMap = new Map(retRows.map((r) => [Number(r.h), r.c]));
  const chart: Array<{ label: string; drop: number; ret: number }> = [];
  for (let h = 8; h <= 20; h++) {
    chart.push({
      label: h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`,
      drop: dropMap.get(h) || 0,
      ret: retMap.get(h) || 0,
    });
  }

  const live: LiveActivity[] = liveRows.map((r) => {
    const action =
      r.returned_at != null
        ? { text: "Car returned", kind: "returned" }
        : r.status === "active"
          ? { text: "Drop-off pending", kind: "active" }
          : r.status === "parked"
            ? { text: "Car parked", kind: "parked" }
            : { text: "Valet retrieval", kind: "retrieval" };
    return {
      id: r.id,
      action: action.text,
      kind: action.kind,
      time: action.kind === "returned" ? r.returned_at : r.created_at,
      plate: r.plate,
      property: r.property,
    };
  });

  return {
    date: start,
    stats: {
      carsParked: stats.cars_parked,
      prevCarsParked,
      avgReturnTime: stats.avg_return_min || 0,
      offersValidated: stats.offers_validated,
      outletSpend: stats.outlet_spend,
      driversOnShift: stats.drivers_on_shift,
      driversTotal: stats.drivers_total,
      overdue: stats.overdue,
    },
    byProperty,
    chart,
    live,
    properties: properties.map((p) => ({ id: p.id, name: p.name, area: p.area })),
  };
}

export async function getQueueOrders(params: {
  days?: number;
  property?: string | null;
  status?: string | null;
  q?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  organizationId?: string | null;
}) {
  const days = Math.min(30, Math.max(1, params.days || 1));
  const propertyId = params.property && params.property !== "all" ? Number(params.property) : null;
  const start = new Date(startOfDay(new Date()).getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const end = new Date(startOfDay(new Date()).getTime() + 24 * 60 * 60 * 1000);

  const dbParams: Array<string | Date | number> = [start, end];
  let where = "WHERE o.created_at >= $1 AND o.created_at < $2";
  if (params.organizationId) {
    dbParams.push(params.organizationId);
    where += ` AND p.organization_id = $${dbParams.length}`;
  }
  if (propertyId) {
    dbParams.push(propertyId);
    where += ` AND o.property_id = $${dbParams.length}`;
  }

  const qValue = String(params.q || "").trim();
  if (qValue) {
    dbParams.push(`%${qValue}%`);
    const n = dbParams.length;
    where += ` AND (o.plate ILIKE $${n} OR o.car_make ILIKE $${n} OR o.car_model ILIKE $${n}
      OR o.zone ILIKE $${n} OR o.slot ILIKE $${n} OR p.name ILIKE $${n}
      OR d.full_name ILIKE $${n} OR c.uid ILIKE $${n})`;
  }

  const OVERDUE_SQL =
    "((o.guest_eta IS NOT NULL AND o.guest_eta < NOW() AND o.status <> 'active' AND o.status <> 'returned') OR (o.guest_eta IS NULL AND o.status IN ('active','parked') AND o.created_at < NOW() - INTERVAL '2 hours'))";
  const TABS: Record<string, string> = {
    to_park: "o.status = 'active'",
    parked: "o.status = 'parked'",
    onway: "o.status IN ('returning','retrieving')",
    overdue: OVERDUE_SQL,
    done: "o.status = 'returned'",
  };
  const statusTab = params.status && TABS[params.status] ? params.status : null;

  let countWhere = where;
  if (statusTab) countWhere += ` AND ${TABS[statusTab]}`;

  const SORTS: Record<string, string> = {
    createdAt: "o.created_at",
    plate: "o.plate",
    car: "o.car_model",
    zone: "o.zone",
    slot: "o.slot",
    status: "o.status",
    property: "p.name",
    driver: "d.full_name",
    cardUid: "c.uid",
  };
  const sortCol = SORTS[params.sort || ""] || "o.created_at";
  const dir = params.dir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const countRows = await q(
    `SELECT COUNT(*)::int AS "all",
            COUNT(*) FILTER (WHERE o.status = 'active')::int AS to_park,
            COUNT(*) FILTER (WHERE o.status = 'parked')::int AS parked,
            COUNT(*) FILTER (WHERE o.status IN ('returning','retrieving'))::int AS onway,
            COUNT(*) FILTER (WHERE ${OVERDUE_SQL})::int AS overdue,
            COUNT(*) FILTER (WHERE o.status = 'returned')::int AS done
     FROM orders o
     JOIN properties p ON p.id = o.property_id
     LEFT JOIN drivers d ON d.id = o.driver_id
     LEFT JOIN nfc_cards c ON c.id = o.card_id
     ${where}`,
    dbParams
  );
  const counts = countRows[0];
  const totalRow = await q(
    `SELECT COUNT(*)::int AS total
     FROM orders o
     JOIN properties p ON p.id = o.property_id
     LEFT JOIN drivers d ON d.id = o.driver_id
     LEFT JOIN nfc_cards c ON c.id = o.card_id
     ${countWhere}`,
    dbParams
  );
  const total = Number(totalRow[0].total);
  const rows = await q(
    `SELECT o.id, o.plate, o.car_make, o.car_model, o.car_color, o.zone, o.slot,
            o.status, o.created_at, o.dropped_at, o.returned_at, o.guest_eta,
            p.name AS property,
            d.full_name AS driver,
            c.uid AS card_uid,
            (SELECT COUNT(*)::int FROM validations v WHERE v.order_id = o.id) AS validations
     FROM orders o
     JOIN properties p ON p.id = o.property_id
     LEFT JOIN drivers d ON d.id = o.driver_id
     LEFT JOIN nfc_cards c ON c.id = o.card_id
     ${countWhere}
     ORDER BY ${sortCol} ${dir} NULLS LAST, o.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    dbParams
  );

  return {
    orders: rows.map((o) => ({
      id: o.id,
      plate: o.plate,
      car: [o.car_color, o.car_make, o.car_model].filter(Boolean).join(" "),
      zone: o.zone,
      slot: o.slot,
      status: o.status,
      createdAt: o.created_at,
      droppedAt: o.dropped_at,
      returnedAt: o.returned_at,
      guestEta: o.guest_eta,
      property: o.property,
      driver: o.driver || "—",
      cardUid: o.card_uid,
      validations: o.validations,
    })),
    counts: {
      all: counts.all,
      toPark: counts.to_park,
      parked: counts.parked,
      onway: counts.onway,
      overdue: counts.overdue,
      done: counts.done,
    },
    total,
    page,
    pageSize,
    properties: await propertiesForScope(params.organizationId),
  };
}

export async function getLocations(organizationId?: string | null) {
  const start = startOfDay(new Date());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const propsParams: Array<string | Date> = [start, end];
  let propsWhere = "";
  if (organizationId) {
    propsParams.push(organizationId);
    propsWhere = `WHERE p.organization_id = $${propsParams.length}`;
  }
  const props = await q(
    `SELECT p.id, p.name, p.area, p.slots_count, p.zones_count, p.card_pool, p.slug, p.uid_start, p.image_url,
            (SELECT COUNT(*)::int FROM drivers d WHERE d.property_id = p.id) AS drivers,
            (SELECT COUNT(*)::int FROM orders o
               WHERE o.property_id = p.id
                 AND o.status IN ('parked','retrieving')
                 AND o.created_at < NOW() - interval '2 hours') AS overdue,
            COUNT(o.id) FILTER (
              WHERE o.created_at >= $1 AND o.created_at < $2
                AND o.status IN ('active','parked','retrieving')
            ) AS occupied
     FROM properties p
     LEFT JOIN orders o ON o.property_id = p.id
     ${propsWhere}
     GROUP BY p.id ORDER BY p.id`,
    propsParams
  );
  const zones = await q("SELECT id, property_id, code, slot_count FROM zones ORDER BY property_id, id", []);
  const zonesByProp: Record<string, Array<{ id: number; code: string; slots: number }>> = {};
  for (const z of zones) {
    (zonesByProp[z.property_id] = zonesByProp[z.property_id] || []).push({
      id: z.id,
      code: z.code,
      slots: z.slot_count,
    });
  }
  const nextUid = await nextUidStart();
  return {
    nextUid: nextUid.toString(),
    properties: props.map((p) => ({
      id: p.id,
      name: p.name,
      area: p.area,
      slug: p.slug,
      uidStart: p.uid_start,
      imageUrl: p.image_url,
      drivers: p.drivers,
      slots: p.slots_count,
      zonesCount: p.zones_count,
      cardPool: p.card_pool,
      occupied: Number(p.occupied),
      overdue: p.overdue,
      zones: zonesByProp[p.id] || [],
    })),
  };
}

// In the merged single-DB layout there is no legacy valet `tenants` table —
// tenant/auth context comes from the platform tables (organizations/sessions).
// properties.tenant_id is kept for column compatibility but left NULL.
async function defaultTenantId(organizationId?: string | null): Promise<string | null> {
  return organizationId ?? null;
}

export interface LocationInput {
  name: string;
  area?: string;
  zones?: number;
  slots?: number;
  cards?: number;
  imageUrl?: string | null;
}

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function createLocation(input: LocationInput, organizationId?: string | null): Promise<{ id: number; name: string }> {
  const zoneCount = Math.max(1, Number(input.zones) || 1);
  const slotCount = Math.max(1, Number(input.slots) || 1);
  const pool = Math.max(1, Number(input.cards) || slotCount * 2);
  const uidStart = await nextUidStart();
  const tenantId = await defaultTenantId(organizationId);

  return transaction(async (exec) => {
    const { rows } = await exec(
      `INSERT INTO properties (tenant_id, organization_id, name, area, zones_count, slots_count, slug, card_pool, uid_start, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        tenantId,
        organizationId || null,
        input.name,
        input.area || "—",
        zoneCount,
        slotCount,
        slugifyName(input.name),
        pool,
        uidStart.toString(),
        input.imageUrl || null,
      ]
    );
    const propId = Number(rows[0].id);
    const perZone = Math.ceil(slotCount / zoneCount);
    for (let z = 0; z < zoneCount; z++) {
      await exec(
        "INSERT INTO zones (property_id, code, slot_count) VALUES ($1,$2,$3)",
        [propId, String.fromCharCode(65 + z), perZone]
      );
    }
    for (let i = 0; i < pool; i++) {
      await exec(
        "INSERT INTO nfc_cards (uid, property_id, status) VALUES ($1,$2,'ready')",
        [String(uidStart + BigInt(i)), propId]
      );
    }
    return { id: propId, name: input.name };
  });
}

export async function updateLocation(id: number, input: LocationInput): Promise<{ id: number; name: string }> {
  const zoneCount = Math.max(1, Number(input.zones) || 1);
  const slotCount = Math.max(1, Number(input.slots) || 1);
  const pool = Math.max(1, Number(input.cards) || slotCount * 2);

  return transaction(async (exec) => {
    await exec(
      `UPDATE properties
       SET name=$1, area=$2, zones_count=$3, slots_count=$4, slug=$5, card_pool=$6, image_url=$7
       WHERE id=$8`,
      [
        input.name,
        input.area || "—",
        zoneCount,
        slotCount,
        slugifyName(input.name),
        pool,
        input.imageUrl || null,
        id,
      ]
    );
    await exec("DELETE FROM zones WHERE property_id=$1", [id]);
    const perZone = Math.ceil(slotCount / zoneCount);
    for (let z = 0; z < zoneCount; z++) {
      await exec(
        "INSERT INTO zones (property_id, code, slot_count) VALUES ($1,$2,$3)",
        [id, String.fromCharCode(65 + z), perZone]
      );
    }
    const existing = Number(((await exec("SELECT COUNT(*)::int AS n FROM nfc_cards WHERE property_id=$1", [id])).rows[0] as any).n);
    if (existing < pool) {
      const uidStart = await nextUidStart();
      for (let i = 0; i < pool - existing; i++) {
        await exec(
          "INSERT INTO nfc_cards (uid, property_id, status) VALUES ($1,$2,'ready')",
          [String(uidStart + BigInt(i)), id]
        );
      }
    }
    return { id, name: input.name };
  });
}

export async function deleteLocation(id: number): Promise<void> {
  await transaction(async (exec) => {
    await exec("DELETE FROM validations WHERE order_id IN (SELECT id FROM orders WHERE property_id=$1)", [id]);
    await exec("DELETE FROM orders WHERE property_id=$1", [id]);
    await exec("DELETE FROM nfc_cards WHERE property_id=$1", [id]);
    await exec("DELETE FROM zones WHERE property_id=$1", [id]);
    await exec("UPDATE drivers SET property_id=NULL WHERE property_id=$1", [id]);
    await exec("DELETE FROM properties WHERE id=$1", [id]);
  });
}

export async function getDrivers(params: { q?: string; property?: string | null; page?: number; pageSize?: number; sort?: string; dir?: "asc" | "desc"; organizationId?: string | null }) {
  const start = startOfDay(new Date());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const propertyId = params.property && params.property !== "all" ? Number(params.property) : null;
  const qValue = String(params.q || "").trim();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 20));
  const offset = (page - 1) * pageSize;
  const SORTS: Record<string, string> = {
    name: "d.full_name",
    valetId: "d.valet_id",
    property: "p.name",
    today: "today",
    avgMin: "avg_min",
  };
  const sortCol = SORTS[params.sort || ""] || "d.full_name";
  const dir = params.dir === "desc" ? "DESC" : "ASC";
  const filterParams: Array<string | number> = [];
  const conds = ["d.status != 'removed'"];
  if (params.organizationId) {
    filterParams.push(params.organizationId);
    conds.push(`d.organization_id = $${filterParams.length}`);
  }
  if (propertyId) {
    filterParams.push(propertyId);
    conds.push(`d.property_id = $${filterParams.length}`);
  }
  if (qValue) {
    filterParams.push(`%${qValue}%`);
    const n = filterParams.length;
    conds.push(`(d.full_name ILIKE $${n} OR d.valet_id ILIKE $${n} OR d.email ILIKE $${n} OR p.name ILIKE $${n})`);
  }
  const driversTotal = (
    await q(
      `SELECT COUNT(*)::int AS total
       FROM drivers d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE ${conds.join(" AND ")}`,
      filterParams
    )
  )[0].total;
  const listConds = conds.map((c, i) =>
    i === 0 ? c : c.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + 2}`)
  );
  const rows = await q(
    `SELECT d.id, d.valet_id, d.full_name, d.initials, d.avatar_color, d.email, d.phone,
            d.status, d.shift_started_at, d.property_id, p.name AS property,
            (SELECT COUNT(*)::int FROM orders o
               WHERE o.driver_id = d.id AND o.created_at >= $1 AND o.created_at < $2) AS today,
            (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60))::int FROM orders o
               WHERE o.driver_id = d.id AND o.returned_at >= $1 AND o.returned_at < $2
                 AND o.dropped_at IS NOT NULL) AS avg_min
     FROM drivers d
     LEFT JOIN properties p ON p.id = d.property_id
     WHERE ${listConds.join(" AND ")}
     ORDER BY ${sortCol} ${dir} NULLS LAST, d.id ASC
     LIMIT ${pageSize} OFFSET ${offset}`,
    [start, end, ...filterParams]
  );
  return {
    drivers: rows.map((d) => ({
      id: d.id,
      valetId: d.valet_id,
      name: d.full_name,
      initials: d.initials,
      color: d.avatar_color,
      email: d.email,
      phone: d.phone,
      status: d.status,
      statusLabel: STATUS_LABEL[d.status] || d.status,
      property: d.property,
      propertyId: d.property_id,
      shiftStarted: d.shift_started_at,
      today: d.today,
      avgMin: d.avg_min || 0,
    })),
    total: driversTotal,
    page,
    pageSize,
    properties: await propertiesForScope(params.organizationId),
  };
}

export interface DriverTableItem {
  id: number;
  valetId: string;
  name: string;
  initials: string;
  color: string;
  email: string | null;
  phone: string | null;
  status: string;
  statusLabel: string;
  property: string | null;
  propertyId: number | null;
  today: number;
  avgMin: number;
  createdAt: Date;
  emiratesId: string | null;
  licenseNumber: string | null;
  nationality: string | null;
  emergencyContact: string | null;
}

export async function listDriversForTable(params: {
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: string | null;
  property?: string | null;
  organizationId?: string | null;
}) {
  const start = startOfDay(new Date());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 15));
  const offset = (page - 1) * pageSize;
  const qValue = String(params.q || "").trim();
  const status = !params.status || params.status === "all" ? null : params.status;
  const property = !params.property || params.property === "all" ? null : params.property;

  const SORTS: Record<string, string> = {
    name: "d.full_name",
    valetId: "d.valet_id",
    property: "p.name",
    today: "today",
    avgMin: "avg_min",
    status: "d.status",
    createdAt: "d.created_at",
  };
  const sortCol = SORTS[params.sortBy || ""] || "d.full_name";
  const dir = params.sortDir === "desc" ? "DESC" : "ASC";

  const filterParams: Array<string | number> = [];
  const conds = ["d.status != 'removed'"];
  if (params.organizationId) {
    filterParams.push(params.organizationId);
    conds.push(`d.organization_id = $${filterParams.length}`);
  }
  if (status) {
    filterParams.push(status);
    conds.push(`d.status = $${filterParams.length}`);
  }
  if (property) {
    filterParams.push(property);
    conds.push(`d.property_id = $${filterParams.length}`);
  }
  if (qValue) {
    filterParams.push(`%${qValue}%`);
    const n = filterParams.length;
    conds.push(
      `(d.full_name ILIKE $${n} OR d.valet_id ILIKE $${n} OR d.email ILIKE $${n} OR p.name ILIKE $${n})`
    );
  }
  const totalCount = (
    await q(
      `SELECT COUNT(*)::int AS total
       FROM drivers d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE ${conds.join(" AND ")}`,
      filterParams
    )
  )[0].total;

  const listConds = conds.map((c, i) =>
    i === 0 ? c : c.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + 2}`)
  );
  const rows = await q(
    `SELECT d.id, d.valet_id, d.full_name, d.initials, d.avatar_color, d.email, d.phone,
            d.status, d.shift_started_at, d.created_at, d.property_id, p.name AS property,
            d.emirates_id, d.license_number, d.nationality, d.emergency_contact,
            (SELECT COUNT(*)::int FROM orders o
               WHERE o.driver_id = d.id AND o.created_at >= $1 AND o.created_at < $2) AS today,
            (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60))::int FROM orders o
               WHERE o.driver_id = d.id AND o.returned_at >= $1 AND o.returned_at < $2
                 AND o.dropped_at IS NOT NULL) AS avg_min
     FROM drivers d
     LEFT JOIN properties p ON p.id = d.property_id
     WHERE ${listConds.join(" AND ")}
     ORDER BY ${sortCol} ${dir} NULLS LAST, d.id ASC
     LIMIT ${pageSize} OFFSET ${offset}`,
    [start, end, ...filterParams]
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items: rows.map<DriverTableItem>((d) => ({
      id: d.id,
      valetId: d.valet_id,
      name: d.full_name,
      initials: d.initials,
      color: d.avatar_color,
      email: d.email,
      phone: d.phone,
      status: d.status,
      statusLabel: STATUS_LABEL[d.status] || d.status,
      property: d.property,
      propertyId: d.property_id,
      today: d.today,
      avgMin: d.avg_min || 0,
      createdAt: d.created_at,
      emiratesId: d.emirates_id,
      licenseNumber: d.license_number,
      nationality: d.nationality,
      emergencyContact: d.emergency_contact,
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    properties: await propertiesForScope(params.organizationId),
  };
}

export interface DriverInput {
  name: string;
  propertyId?: string | number | null;
  email?: string | null;
  phone?: string | null;
  emiratesId?: string | null;
  licenseNumber?: string | null;
  nationality?: string | null;
  emergencyContact?: string | null;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export interface DriverDetail {
  driver: {
    id: number;
    valetId: string;
    name: string;
    initials: string;
    color: string;
    email: string | null;
    phone: string | null;
    emiratesId: string | null;
    licenseNumber: string | null;
    nationality: string | null;
    emergencyContact: string | null;
    status: string;
    statusLabel: string;
    property: string | null;
    propertyId: number | null;
    shiftStarted: Date | null;
    createdAt: Date;
    today: number;
    avgMin: number;
  };
  activeOrders: Array<{
    id: number;
    plate: string;
    car: string;
    zone: string | null;
    slot: string | null;
    status: string;
    createdAt: Date;
    droppedAt: Date | null;
    guestEta: Date | null;
    cardUid: string | null;
  }>;
  recentReturned: Array<{
    id: number;
    plate: string;
    car: string;
    returnedAt: Date | null;
    returnMin: number;
  }>;
}

export async function getDriverDetail(id: number, organizationId?: string | null): Promise<DriverDetail> {
  const start = startOfDay(new Date());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const driverParams: Array<string | Date | number> = [start, end, id];
  let driverWhere = "WHERE d.id = $3";
  if (organizationId) {
    driverParams.push(organizationId);
    driverWhere += ` AND d.organization_id = $${driverParams.length}`;
  }
  const rows = await q(
    `SELECT d.id, d.valet_id, d.full_name, d.initials, d.avatar_color, d.email, d.phone,
            d.emirates_id, d.license_number, d.nationality, d.emergency_contact,
            d.status, d.shift_started_at, d.created_at, d.property_id, p.name AS property,
            (SELECT COUNT(*)::int FROM orders o
               WHERE o.driver_id = d.id AND o.created_at >= $1 AND o.created_at < $2) AS today,
            (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60))::int FROM orders o
               WHERE o.driver_id = d.id AND o.returned_at >= $1 AND o.returned_at < $2
                 AND o.dropped_at IS NOT NULL) AS avg_min
     FROM drivers d
     LEFT JOIN properties p ON p.id = d.property_id
     ${driverWhere}`,
    driverParams
  );
  const driver = rows[0];
  if (!driver) throw new Error("Driver not found");
  const activeOrders = await q(
    `SELECT o.id, o.plate, o.car_make, o.car_model, o.car_color, o.zone, o.slot,
            o.status, o.created_at, o.dropped_at, o.guest_eta,
            c.uid AS card_uid
     FROM orders o
     LEFT JOIN nfc_cards c ON c.id = o.card_id
     WHERE o.driver_id = $1 AND o.status IN ('active','parked','retrieving','returning')
     ORDER BY o.created_at DESC`,
    [id]
  );
  const recentReturned = await q(
    `SELECT o.id, o.plate, o.car_make, o.car_model, o.car_color, o.status,
            o.dropped_at, o.returned_at,
            ROUND(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60)::int AS return_min
     FROM orders o
     WHERE o.driver_id = $1 AND o.status = 'returned' AND o.returned_at >= $2
     ORDER BY o.returned_at DESC LIMIT 5`,
    [id, start]
  );
  return {
    driver: {
      id: driver.id,
      valetId: driver.valet_id,
      name: driver.full_name,
      initials: driver.initials,
      color: driver.avatar_color,
      email: driver.email,
      phone: driver.phone,
      emiratesId: driver.emirates_id,
      licenseNumber: driver.license_number,
      nationality: driver.nationality,
      emergencyContact: driver.emergency_contact,
      status: driver.status,
      statusLabel: STATUS_LABEL[driver.status] || driver.status,
      property: driver.property,
      propertyId: driver.property_id,
      shiftStarted: driver.shift_started_at,
      createdAt: driver.created_at,
      today: driver.today,
      avgMin: driver.avg_min || 0,
    },
    activeOrders: activeOrders.map((o) => ({
      id: o.id,
      plate: o.plate,
      car: [o.car_make, o.car_model, o.car_color].filter(Boolean).join(" "),
      zone: o.zone,
      slot: o.slot,
      status: o.status,
      createdAt: o.created_at,
      droppedAt: o.dropped_at,
      guestEta: o.guest_eta,
      cardUid: o.card_uid,
    })),
    recentReturned: recentReturned.map((o) => ({
      id: o.id,
      plate: o.plate,
      car: [o.car_make, o.car_model, o.car_color].filter(Boolean).join(" "),
      returnedAt: o.returned_at,
      returnMin: o.return_min,
    })),
  };
}

export async function createDriver(input: DriverInput & { password: string }, organizationId?: string | null): Promise<{
  id: number;
  valetId: string;
  pin: string;
  password: string;
  name: string;
}> {
  const { count } = (
    await q("SELECT COALESCE(MAX(id), 0) AS count FROM drivers", [])
  )[0];
  const valetId = makeValetId(Number(count) + 1);
  const customPassword = String(input.password);
  const colors = ["#1C2B46", "#4A5FC9", "#0C9D61", "#9AA6BC", "#2A3C61", "#B97B17"];
  const color = colors[(Number(count) + 1) % colors.length];
  const { rows } = await query(
    `INSERT INTO drivers (valet_id, full_name, initials, avatar_color, organization_id, property_id, email, phone,
       emirates_id, license_number, nationality, emergency_contact,
       pin, password_hash, status, shift_started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'off_duty',NULL)
     RETURNING id, valet_id, pin`,
    [
      valetId,
      input.name,
      initials(input.name),
      color,
      organizationId || null,
      Number(input.propertyId) || null,
      input.email || null,
      input.phone || null,
      input.emiratesId || null,
      input.licenseNumber || null,
      input.nationality || null,
      input.emergencyContact || null,
      makePin(),
      hashPassword(customPassword),
    ]
  );
  const d = rows[0];
  return { id: Number(d.id), valetId: d.valet_id, pin: d.pin, password: customPassword, name: input.name };
}

export async function toggleDriverShift(id: number, on: boolean): Promise<void> {
  if (on) {
    await query("UPDATE drivers SET status='on_shift', shift_started_at=NOW() WHERE id=$1", [id]);
  } else {
    await query("UPDATE drivers SET status='off_duty', shift_started_at=NULL WHERE id=$1", [id]);
  }
}

export async function resetDriverPassword(id: number, newPassword: string): Promise<void> {
  await query("UPDATE drivers SET password_hash = $2 WHERE id = $1", [id, hashPassword(String(newPassword))]);
}

export async function updateDriver(id: number, input: DriverInput): Promise<void> {
  const sets: string[] = [];
  const vals: Array<string | number | null> = [id];
  sets.push(`full_name = $${vals.length + 1}`);
  vals.push(input.name);
  sets.push(`initials = $${vals.length + 1}`);
  vals.push(initials(input.name));
  if (input.propertyId !== undefined) { sets.push(`property_id = $${vals.length + 1}`); vals.push(Number(input.propertyId) || null); }
  if (input.email !== undefined) { sets.push(`email = $${vals.length + 1}`); vals.push(input.email || null); }
  if (input.phone !== undefined) { sets.push(`phone = $${vals.length + 1}`); vals.push(input.phone || null); }
  if (input.emiratesId !== undefined) { sets.push(`emirates_id = $${vals.length + 1}`); vals.push(input.emiratesId || null); }
  if (input.licenseNumber !== undefined) { sets.push(`license_number = $${vals.length + 1}`); vals.push(input.licenseNumber || null); }
  if (input.nationality !== undefined) { sets.push(`nationality = $${vals.length + 1}`); vals.push(input.nationality || null); }
  if (input.emergencyContact !== undefined) { sets.push(`emergency_contact = $${vals.length + 1}`); vals.push(input.emergencyContact || null); }
  await query(`UPDATE drivers SET ${sets.join(", ")} WHERE id = $1`, vals);
}

export async function removeDriver(id: number): Promise<void> {
  await query(
    "UPDATE drivers SET status = 'removed', shift_started_at = NULL, token_version = COALESCE(token_version, 0) + 1 WHERE id = $1",
    [id]
  );
}

export interface CardTableItem {
  id: number;
  uid: string;
  status: string;
  statusLabel: string;
  statusTone: string;
  uses: number;
  property: string;
  propertyId: number;
  order: string;
  orderMuted: boolean;
  by: string;
}

export async function listCardsForTable(params: {
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: string | null;
  property?: string | null;
  organizationId?: string | null;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 15));
  const offset = (page - 1) * pageSize;
  const qValue = String(params.q || "").trim();
  const status = !params.status || params.status === "all" ? null : params.status;
  const property = !params.property || params.property === "all" ? null : params.property;

  const SORTS: Record<string, string> = {
    uid: "c.uid",
    property: "p.name",
    status: "c.status",
    uses: "c.uses_count",
    lastUsed: "last.last_at",
  };
  const sortCol = SORTS[params.sortBy || ""] || "c.uid";
  const dir = params.sortDir === "desc" ? "DESC" : "ASC";

  const filterParams: Array<string | number> = [];
  const conds: string[] = [];
  if (params.organizationId) {
    filterParams.push(params.organizationId);
    conds.push(`p.organization_id = $${filterParams.length}`);
  }
  if (status) {
    filterParams.push(status);
    conds.push(`c.status = $${filterParams.length}`);
  }
  if (property) {
    filterParams.push(property);
    conds.push(`c.property_id = $${filterParams.length}`);
  }
  if (qValue) {
    filterParams.push(`%${qValue}%`);
    conds.push(`c.uid ILIKE $${filterParams.length}`);
  }
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

  const totalCount = (
    await q(
      `SELECT COUNT(*)::int AS total
       FROM nfc_cards c
       JOIN properties p ON p.id = c.property_id
       ${where}`,
      filterParams
    )
  )[0].total;

  const rows = await q(
    `SELECT c.id, c.uid, c.status, c.uses_count, c.property_id, p.name AS property,
            last.plate, last.car_make, last.car_model, last.zone, last.slot,
            last.order_status, last.by_name, last.last_at
     FROM nfc_cards c
     JOIN properties p ON p.id = c.property_id
     LEFT JOIN LATERAL (
       SELECT o.plate, o.car_make, o.car_model, o.zone, o.slot, o.status AS order_status,
              d.full_name AS by_name, o.created_at AS last_at
       FROM orders o
       LEFT JOIN drivers d ON d.id = o.driver_id
       WHERE o.card_id = c.id
       ORDER BY o.id DESC LIMIT 1
     ) last ON true
     ${where}
     ORDER BY ${sortCol} ${dir} NULLS LAST, c.id ASC
     LIMIT ${pageSize} OFFSET ${offset}`,
    filterParams
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items: rows.map<CardTableItem>((c) => ({
      id: c.id,
      uid: c.uid,
      status: c.status,
      statusLabel:
        c.status === "with_guest"
          ? "● WITH GUEST"
          : c.status === "returned"
            ? "● RETURNED"
            : c.status === "ready"
              ? "READY"
              : "LOST · BLOCKED",
      statusTone:
        c.status === "with_guest" ? "orange" : c.status === "returned" ? "amber" : c.status === "ready" ? "green" : "red",
      uses: c.uses_count,
      property: c.property,
      propertyId: c.property_id,
      order: c.plate
        ? `${c.plate} · ${c.car_make} ${c.car_model}${c.zone ? ` · Zone ${c.zone}-${c.slot}` : ""}`
        : "—",
      orderMuted: c.order_status !== "active",
      by: c.by_name
        ? `${c.by_name}${c.last_at ? " · " + new Date(c.last_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}`
        : "—",
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    properties: await propertiesForScope(params.organizationId),
  };
}

export async function registerCards(input: {
  propertyId: number;
  prefix: string;
  from: number;
  to: number;
}): Promise<{ created: number; from: string; to: string }> {
  const pfx = String(input.prefix || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(pfx)) throw new Error("Prefix must be exactly 3 letters (A–Z)");
  const startNum = Number(input.from);
  const endNum = Number(input.to);
  if (!Number.isInteger(startNum) || !Number.isInteger(endNum)) throw new Error("From and To must be whole numbers");
  if (startNum < 1 || endNum < startNum) throw new Error("Range is invalid");
  if (endNum - startNum + 1 > 500) throw new Error("Create at most 500 cards per batch");

  const pad = Math.max(5, String(endNum).length);
  const uids: string[] = [];
  for (let n = startNum; n <= endNum; n++) {
    uids.push(`${pfx}-${String(n).padStart(pad, "0")}`);
  }
  const clashes = (
    await q("SELECT uid FROM nfc_cards WHERE uid = ANY($1::text[]) ORDER BY uid LIMIT 5", [uids])
  ).map((r) => r.uid);
  if (clashes.length > 0) {
    throw new Error(`UIDs already exist in this range (e.g. ${clashes.join(", ")}). Pick another range.`);
  }

  const sync = (await q("SELECT setval('nfc_cards_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM nfc_cards), (SELECT last_value FROM nfc_cards_id_seq)))"))[0];
  void sync;

  for (const uid of uids) {
    await q("INSERT INTO nfc_cards (uid, property_id, status) VALUES ($1,$2,'ready')", [uid, input.propertyId]);
  }
  return { created: uids.length, from: uids[0], to: uids[uids.length - 1] };
}

export async function updateCardUid(id: number, uid: string): Promise<{ uid: string }> {
  const next = String(uid || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,24}$/.test(next)) {
    throw new Error("UID may only contain A–Z, 0–9 and dashes (max 24)");
  }
  const clash = (await q("SELECT id FROM nfc_cards WHERE uid = $1 AND id <> $2", [next, id]))[0];
  if (clash) throw new Error(`UID ${next} is already used by another card`);
  await q("UPDATE nfc_cards SET uid = $2 WHERE id = $1", [id, next]);
  return { uid: next };
}

export async function setCardStatus(id: number, action: "block" | "unblock" | "mark-returned" | "lost"): Promise<void> {
  if (action === "block") {
    await q("UPDATE nfc_cards SET status = 'blocked' WHERE id = $1", [id]);
  } else if (action === "unblock") {
    await q("UPDATE nfc_cards SET status = 'ready' WHERE id = $1", [id]);
  } else if (action === "mark-returned") {
    const card = (await q("SELECT status FROM nfc_cards WHERE id = $1", [id]))[0];
    if (card?.status !== "returned") throw new Error("Card is not in 'returned' status");
    await q("UPDATE nfc_cards SET status = 'ready' WHERE id = $1", [id]);
  } else if (action === "lost") {
    await q("UPDATE nfc_cards SET status = 'blocked', lost_at = CURRENT_DATE WHERE id = $1", [id]);
  }
}

export async function removeCard(id: number): Promise<void> {
  await q("DELETE FROM nfc_cards WHERE id = $1", [id]);
}

export async function getOffers(params: { property?: string | null; organizationId?: string | null }) {
  const propertyId = params.property && params.property !== "all" ? Number(params.property) : null;
  const dbParams: Array<string | number> = [];
  let where = "";
  if (params.organizationId) {
    dbParams.push(params.organizationId);
    where += ` WHERE p.organization_id = $${dbParams.length}`;
  }
  if (propertyId) {
    dbParams.push(propertyId);
    where += where ? ` AND o.property_id = $${dbParams.length}` : ` WHERE o.property_id = $${dbParams.length}`;
  }
  const rows = await q(
    `      SELECT o.id, o.title, o.category, o.price, o.description, o.featured, o.live, o.draft,
            o.validates_valet, o.ends_on, o.views_7d, p.name AS property, o.property_id,
            o.image_url, o.menu_url, o.was_price, o.rating, o.reviews, o.level,
            o.opens_at, o.closes_at, o.staff_code, o.deal_tag
     FROM offers o
     LEFT JOIN properties p ON p.id = o.property_id
     ${where}
     ORDER BY o.id`,
    dbParams
  );
  return {
    offers: rows.map((o) => ({
      id: o.id,
      title: o.title,
      category: o.category,
      price: Number(o.price),
      wasPrice: o.was_price == null ? null : Number(o.was_price),
      desc: o.description,
      featured: o.featured,
      live: o.live,
      draft: o.draft,
      validatesValet: o.validates_valet,
      endsOn: o.ends_on,
      views7d: o.views_7d,
      property: o.property,
      propertyId: o.property_id,
      imageUrl: o.image_url,
      menuUrl: o.menu_url,
      rating: Number(o.rating),
      reviews: o.reviews,
      level: o.level,
      dealTag: o.deal_tag,
      statusLabel: o.draft ? "Draft" : o.live ? (o.featured ? "Featured" : "Live") : "Hidden",
      statusTone: o.draft ? "draft" : o.live ? (o.featured ? "featured" : "live") : "hidden",
    })),
    properties: await propertiesForScope(params.organizationId),
  };
}

export interface OfferTableItem {
  id: number;
  title: string;
  category: string | null;
  price: number;
  wasPrice: number | null;
  desc: string | null;
  featured: number | null;
  live: boolean;
  draft: boolean;
  validatesValet: boolean;
  endsOn: string | null;
  views7d: number;
  property: string | null;
  propertyId: number | null;
  imageUrl: string | null;
  menuUrl: string | null;
  rating: number;
  reviews: number;
  level: string | null;
  statusLabel: string;
  statusTone: string;
}

export async function listOffersForTable(params: {
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: string | null;
  property?: string | null;
  organizationId?: string | null;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 15));
  const offset = (page - 1) * pageSize;
  const qValue = String(params.q || "").trim();
  const status = !params.status || params.status === "all" ? null : params.status;
  const property = !params.property || params.property === "all" ? null : params.property;

  const SORTS: Record<string, string> = {
    title: "o.title",
    category: "o.category",
    price: "o.price",
    property: "p.name",
    views: "o.views_7d",
    rating: "o.rating",
    status: "o.draft",
  };
  const sortCol = SORTS[params.sortBy || ""] || "o.id";
  const dir = params.sortDir === "desc" ? "DESC" : "ASC";

  const filterParams: Array<string | number> = [];
  const conds: string[] = [];
  if (params.organizationId) {
    filterParams.push(params.organizationId);
    conds.push(`p.organization_id = $${filterParams.length}`);
  }
  if (status) {
    if (status === "live") conds.push("o.draft = false AND o.live = true AND o.featured IS NULL");
    else if (status === "featured") conds.push("o.draft = false AND o.live = true AND o.featured IS NOT NULL");
    else if (status === "draft") conds.push("o.draft = true");
    else if (status === "hidden") conds.push("o.live = false AND o.draft = false");
  }
  if (property) {
    filterParams.push(property);
    conds.push(`o.property_id = $${filterParams.length}`);
  }
  if (qValue) {
    filterParams.push(`%${qValue}%`);
    conds.push(`(o.title ILIKE $${filterParams.length} OR o.category ILIKE $${filterParams.length})`);
  }
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

  const totalCount = (
    await q(
      `SELECT COUNT(*)::int AS total
       FROM offers o
       LEFT JOIN properties p ON p.id = o.property_id
       ${where}`,
      filterParams
    )
  )[0].total;

  const rows = await q(
    `SELECT o.id, o.title, o.category, o.price, o.description, o.featured, o.live, o.draft,
            o.validates_valet, o.ends_on, o.views_7d, p.name AS property,
            o.image_url, o.menu_url, o.was_price, o.rating, o.reviews, o.level, o.property_id
     FROM offers o
     LEFT JOIN properties p ON p.id = o.property_id
     ${where}
     ORDER BY ${sortCol} ${dir} NULLS LAST, o.id ASC
     LIMIT ${pageSize} OFFSET ${offset}`,
    filterParams
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items: rows.map<OfferTableItem>((o) => ({
      id: o.id,
      title: o.title,
      category: o.category,
      price: Number(o.price),
      wasPrice: o.was_price == null ? null : Number(o.was_price),
      desc: o.description,
      featured: o.featured,
      live: o.live,
      draft: o.draft,
      validatesValet: o.validates_valet,
      endsOn: o.ends_on,
      views7d: o.views_7d,
      property: o.property,
      propertyId: o.property_id,
      imageUrl: o.image_url,
      menuUrl: o.menu_url,
      rating: Number(o.rating),
      reviews: o.reviews,
      level: o.level,
      statusLabel: o.draft ? "Draft" : o.live ? (o.featured ? "Featured" : "Live") : "Hidden",
      statusTone: o.draft ? "draft" : o.live ? (o.featured ? "featured" : "live") : "hidden",
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    properties: await propertiesForScope(params.organizationId),
  };
}

export interface OfferInput {
  title: string;
  category?: string | null;
  price: number;
  desc?: string | null;
  imageUrl?: string | null;
  menuUrl?: string | null;
  wasPrice?: number | null;
  propertyId?: string | number | null;
}

export async function createOffer(input: OfferInput): Promise<{ id: number }> {
  let propertyId = input.propertyId ? Number(input.propertyId) : null;
  if (!propertyId) {
    const props = await propertiesForScope();
    propertyId = props[0]?.id ?? null;
  }
  await q(
    "SELECT setval('offers_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM offers), (SELECT last_value FROM offers_id_seq)))"
  );
  const rows = await q(
    `INSERT INTO offers (property_id, title, category, price, description, live, validates_valet, views_7d, image_url, menu_url, was_price)
     VALUES ($1,$2,$3,$4,$5,true,true,0,$6,$7,$8) RETURNING id`,
    [
      propertyId,
      input.title,
      input.category || "Dining",
      Number(input.price),
      input.desc || null,
      input.imageUrl || null,
      input.menuUrl || null,
      input.wasPrice == null ? null : Number(input.wasPrice),
    ]
  );
  return { id: Number(rows[0].id) };
}

export async function updateOffer(id: number, input: OfferInput): Promise<void> {
  const sets = ["title=$2", "category=$3", "price=$4", "description=$5", "image_url=$6", "menu_url=$7", "was_price=$8", "property_id=$9"];
  const vals: Array<string | number | null> = [
    id,
    input.title,
    input.category || "Dining",
    Number(input.price),
    input.desc || null,
    input.imageUrl || null,
    input.menuUrl || null,
    input.wasPrice == null ? null : Number(input.wasPrice),
    Number(input.propertyId) || null,
  ];
  await q(`UPDATE offers SET ${sets.join(", ")} WHERE id=$1`, vals);
}

export async function setOfferState(
  id: number,
  state: { live?: boolean; featured?: boolean | number | null; draft?: boolean }
): Promise<void> {
  const cur = (
    await q("SELECT live, featured, draft FROM offers WHERE id=$1", [id])
  )[0];
  if (!cur) throw new Error("Offer not found");
  const live = typeof state.live === "boolean" ? state.live : cur.live;
  const draft = typeof state.draft === "boolean" ? state.draft : cur.draft;
  let featured = cur.featured;
  if (state.featured !== undefined) {
    if (state.featured === null || state.featured === false) {
      featured = null;
    } else if (typeof state.featured === "number") {
      featured = state.featured;
    } else {
      featured = 1;
    }
  }
  if (featured !== null) {
    await q("UPDATE offers SET featured = NULL WHERE featured = $1 AND id <> $2", [featured, id]);
  }
  await q("UPDATE offers SET live=$2, featured=$3, draft=$4 WHERE id=$1", [id, live, featured, draft]);
}

export async function deleteOffer(id: number): Promise<void> {
  await q("DELETE FROM offers WHERE id=$1", [id]);
}

export async function getReports(params: { days?: number; property?: string | null; from?: string; to?: string; organizationId?: string | null }) {
  const days = Math.min(60, Math.max(2, params.days || 7));
  const propertyId = params.property && params.property !== "all" ? Number(params.property) : null;
  const today = startOfDay(new Date());
  const to = params.to ? parseDate(params.to) : today;
  const end = to > today ? today : to;
  const from = params.from
    ? parseDate(params.from)
    : new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const start = from > end ? end : from;

  let propClause = "";
  let valPropClause = "";
  const dbParams: Array<string | Date | number> = [start, new Date(end.getTime() + 24 * 60 * 60 * 1000)];
  if (params.organizationId) {
    dbParams.push(params.organizationId);
    const n = dbParams.length;
    propClause += ` AND o.property_id IN (SELECT id FROM properties WHERE organization_id = $${n})`;
    valPropClause += ` AND v.order_id IN (SELECT oo.id FROM orders oo JOIN properties pp ON pp.id = oo.property_id WHERE pp.organization_id = $${n})`;
  }
  if (propertyId) {
    dbParams.push(propertyId);
    const n = dbParams.length;
    propClause += ` AND o.property_id = $${n}`;
    valPropClause += ` AND v.order_id IN (SELECT id FROM orders WHERE property_id = $${n})`;
  }

  const rows = await q(
    `WITH days AS (
       SELECT d::date AS day
       FROM generate_series($1::date, ($2::date - interval '1 day'), '1 day') AS d
     )
     SELECT
       days.day,
       COALESCE((SELECT COUNT(*)::int FROM orders o WHERE o.created_at >= days.day AND o.created_at < days.day + interval '1 day' ${propClause}), 0) AS drop_offs,
       COALESCE((SELECT COUNT(*)::int FROM orders o WHERE o.returned_at >= days.day AND o.returned_at < days.day + interval '1 day' ${propClause}), 0) AS returns,
       COALESCE((SELECT ROUND(AVG(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60))::int FROM orders o WHERE o.returned_at >= days.day AND o.returned_at < days.day + interval '1 day' AND o.dropped_at IS NOT NULL ${propClause}), 0) AS avg_min,
       COALESCE((SELECT ROUND(AVG(EXTRACT(EPOCH FROM (o.dropped_at - o.created_at)) / 60))::int FROM orders o WHERE o.dropped_at >= days.day AND o.dropped_at < days.day + interval '1 day' AND o.dropped_at IS NOT NULL ${propClause}), 0) AS avg_park_min,
       COALESCE((SELECT COUNT(*)::int FROM orders o WHERE o.created_at < days.day + interval '1 day' AND o.status IN ('parked','retrieving') AND o.returned_at IS NULL ${propClause}), 0) AS overdue,
       COALESCE((SELECT COUNT(*)::int FROM validations v WHERE v.created_at >= days.day AND v.created_at < days.day + interval '1 day' ${valPropClause}), 0) AS validations,
       COALESCE((SELECT COALESCE(SUM(v.amount),0)::int FROM validations v WHERE v.created_at >= days.day AND v.created_at < days.day + interval '1 day' ${valPropClause}), 0) AS spend
     FROM days
     ORDER BY days.day ASC`,
    dbParams
  );

  return {
    rows: rows.map((r) => ({
      day: DAY_LABELS[new Date(r.day).getDay()],
      date: iso(new Date(r.day)),
      dropOffs: r.drop_offs,
      returns: r.returns,
      avgMin: r.avg_min || 0,
      avgParkMin: r.avg_park_min || 0,
      overdue: r.overdue,
      validations: r.validations,
      spend: r.spend,
      isToday: iso(new Date(r.day)) === iso(today),
    })),
    properties: await propertiesForScope(),
  };
}