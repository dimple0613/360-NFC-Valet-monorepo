import { Prisma } from "../generated/client";
import { isBypassingTenantScoping, requireTenantOrganizationId } from "./tenant-context";

// FR-101/FR-102: tenant scoping is enforced here, once, at the persistence layer —
// not something every service/handler has to remember to add to its own queries.
//
// Every model listed below carries a plain, indexed `organizationId` column (see
// schema.prisma). For each operation this extension either merges `organizationId`
// into the `where` clause (reads, updates, deletes — so a query can never touch
// another org's rows) or forces it into `data` (creates — so a caller can never
// spoof a row into a different org than the one they're currently scoped to).
//
// Known limitation: nested relational writes (e.g. `data: { role: { create: {...} } }`)
// are NOT covered — only top-level operations on these models are scoped. Avoid nested
// writes on tenant-scoped models until this extension grows support for them.

const TENANT_SCOPED_MODELS = [
  "organizationMembership",
  "role",
  "rolePermission",
  "userRole",
  "organizationSetting",
  "subscription",
  "subscriptionAddOn",
  "organizationFeatureOverride",
  "invoice",
  "invoiceLineItem",
  "inAppNotification",
] as const;

// Audit records are immutable (CLAUDE.md's load-bearing rule, FR-280/282): scoped
// the same way as the models above for reads/creates, but update/delete always
// throw, unconditionally — even the unsafeRunWithoutTenantScoping bypass doesn't
// exempt this, since "immutable" has no legitimate exception in Phase 1. A future
// GDPR-redaction need should get its own explicit, narrow write path rather than
// reopening general mutability here.
// ResourceUsageEvent joins this list too: it's a billing-relevant ledger
// (FR-173) — corrections should be a new compensating event (e.g. a negative
// amount), never an edit to history, same reasoning as an audit trail.
// CreditNote is FR-201's correction mechanism for an Invoice — itself
// append-only for the same reason a correction to an audit trail can't be a
// silent edit.
const IMMUTABLE_TENANT_SCOPED_MODELS = [
  "auditLog",
  "resourceUsageEvent",
  "subscriptionEvent",
  "creditNote",
] as const;

export class ImmutableRecordError extends Error {
  constructor(operation: string, model: string) {
    super(
      `${model} records are immutable — ${operation} is not allowed. Corrections must be ` +
        `additive (a new record), never an in-place edit.`,
    );
    this.name = "ImmutableRecordError";
  }
}

// Prisma's extension types don't support building the `query` config dynamically
// across a list of model names — each model/operation pair has its own generated
// arg/result type. We build it with loose types instead and hand the whole thing
// to `$extends` with a single documented `as any`; correctness is covered by the
// tenant-isolation regression tests rather than the type checker here.
function scopedModelHandlers() {
  return {
    async findFirst({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async findFirstOrThrow({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async findMany({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    // findUnique(OrThrow) narrows by a unique field, but Prisma's "extended where
    // unique input" allows extra non-unique filter fields alongside it — so adding
    // organizationId here still works: a match on id but the wrong org yields null
    // (or throws, for OrThrow), never the other org's row.
    async findUnique({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async findUniqueOrThrow({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async count({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async aggregate({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async groupBy({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async create({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query({ ...args, data: { ...args.data, organizationId } });
    },
    async createMany({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      const data = Array.isArray(args.data) ? args.data : [args.data];
      return query({ ...args, data: data.map((row: object) => ({ ...row, organizationId })) });
    },
    async update({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async updateMany({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async upsert({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query({
        ...args,
        where: { ...args.where, organizationId },
        create: { ...args.create, organizationId },
      });
    },
    async delete({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
    async deleteMany({ args, query, operation, model }: AnyQueryArgs) {
      if (isBypassingTenantScoping()) return query(args);
      const organizationId = requireTenantOrganizationId(operation, model);
      return query(withOrgFilter(args, organizationId));
    },
  };
}

function immutableScopedModelHandlers() {
  const base = scopedModelHandlers();
  const reject = ({ operation, model }: AnyQueryArgs) => {
    throw new ImmutableRecordError(operation, model);
  };
  return {
    findFirst: base.findFirst,
    findFirstOrThrow: base.findFirstOrThrow,
    findMany: base.findMany,
    findUnique: base.findUnique,
    findUniqueOrThrow: base.findUniqueOrThrow,
    count: base.count,
    aggregate: base.aggregate,
    groupBy: base.groupBy,
    create: base.create,
    createMany: base.createMany,
    update: reject,
    updateMany: reject,
    upsert: reject,
    delete: reject,
    deleteMany: reject,
  };
}

interface AnyQueryArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: { where?: Record<string, unknown>; data?: any; create?: any };
  query: (args: unknown) => Promise<unknown>;
  operation: string;
  model: string;
}

function withOrgFilter(
  args: { where?: Record<string, unknown> },
  organizationId: string,
): { where: Record<string, unknown> } {
  return { ...args, where: { ...(args.where ?? {}), organizationId } };
}

export const tenantScopingExtension = Prisma.defineExtension((client) => {
  const query: Record<string, unknown> = {};
  for (const model of TENANT_SCOPED_MODELS) {
    query[model] = scopedModelHandlers();
  }
  for (const model of IMMUTABLE_TENANT_SCOPED_MODELS) {
    query[model] = immutableScopedModelHandlers();
  }

  return client.$extends({
    name: "tenant-scoping",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: query as any,
  });
});
