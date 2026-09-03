-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "organizationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "organizationId" DROP NOT NULL;

-- Global roles (organizationId IS NULL) need slug-uniqueness too, but the
-- existing @@unique([organizationId, slug]) constraint doesn't enforce it —
-- Postgres treats every NULL as distinct, so it would silently allow
-- duplicate global slugs. A partial unique index covers exactly that case;
-- Prisma has no schema-level syntax for a partial index, so it's not
-- reflected in schema.prisma and must be preserved by hand in any future
-- migration that touches this table.
CREATE UNIQUE INDEX "roles_global_slug_key" ON "roles" ("slug") WHERE "organizationId" IS NULL;
