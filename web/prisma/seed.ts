import { CORE_PERMISSIONS } from "../src/lib/db/core-permissions";
import { VALET_PERMISSIONS } from "../src/lib/db/valet-permissions";
import { registerPermissions } from "../src/lib/db/permission-registry";
import { CORE_RESOURCE_TYPES } from "../src/lib/db/billing/core-resource-types";
import { registerResourceTypes } from "../src/lib/db/billing/resource-types";
import { CORE_NOTIFICATION_KINDS } from "../src/lib/db/notifications/core-notification-kinds";
import { registerNotificationKinds } from "../src/lib/db/notifications/notification-kind-registry";
import { CORE_CURRENCIES, seedCoreCurrencies } from "../src/lib/db/billing/currencies";
import { prismaWithoutTenantScoping } from "../src/lib/db/client";

// FR-152/FR-170/§2.14: "install time" for core, run as `pnpm --filter web run db:seed`.
// Idempotent — safe to re-run on every deploy, not just once.
async function main() {
  await registerPermissions(CORE_PERMISSIONS);
  console.log(`Registered ${CORE_PERMISSIONS.length} core permissions.`);

  await registerPermissions(VALET_PERMISSIONS);
  console.log(`Registered ${VALET_PERMISSIONS.length} valet permissions.`);

  await registerResourceTypes(CORE_RESOURCE_TYPES);
  console.log(`Registered ${CORE_RESOURCE_TYPES.length} core resource types.`);

  await registerNotificationKinds(CORE_NOTIFICATION_KINDS);
  console.log(`Registered ${CORE_NOTIFICATION_KINDS.length} core notification kinds.`);

  await seedCoreCurrencies();
  console.log(`Registered ${CORE_CURRENCIES.length} core currencies.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaWithoutTenantScoping.$disconnect();
  });
