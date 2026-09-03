import { CORE_PERMISSIONS } from "../src/core-permissions";
import { registerPermissions } from "../src/permission-registry";
import { CORE_RESOURCE_TYPES } from "../src/billing/core-resource-types";
import { registerResourceTypes } from "../src/billing/resource-types";
import { CORE_NOTIFICATION_KINDS } from "../src/notifications/core-notification-kinds";
import { registerNotificationKinds } from "../src/notifications/notification-kind-registry";
import { CORE_CURRENCIES, seedCoreCurrencies } from "../src/billing/currencies";
import { prismaWithoutTenantScoping } from "../src/client";

// FR-152/FR-170/§2.14: "install time" for core, run as `pnpm --filter @saasclaude/db run seed`.
// Idempotent — safe to re-run on every deploy, not just once.
async function main() {
  await registerPermissions(CORE_PERMISSIONS);
  console.log(`Registered ${CORE_PERMISSIONS.length} core permissions.`);

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
