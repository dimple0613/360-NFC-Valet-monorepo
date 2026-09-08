import type { PermissionDefinition } from "./permission-registry";

// The valet business surface's TENANT-scope permission manifest ("install time"
// registration for the valet module — registered alongside core in
// prisma/seed.ts). Drives both the Tenant Admin sidebar/route gating and the
// Role → permission pickers, so a member who isn't granted a capability simply
// doesn't see (or cannot open) the matching page — no divergent UI-only check.
//
// Naming follows the core convention `module.resource.action`, keyspaced under
// `valet.` to avoid any collision with core permissions.

export const VALET_PERMISSIONS: PermissionDefinition[] = [
  {
    key: "valet.dashboard.read",
    module: "valet",
    scope: "TENANT",
    description: "View the live operations dashboard with counts and queues.",
  },
  {
    key: "valet.queue.read",
    module: "valet",
    scope: "TENANT",
    description: "View the live queue, filter/search it, and see order details.",
  },
  {
    key: "valet.queue.manage",
    module: "valet",
    scope: "TENANT",
    description: "Update order status (collect, delay, release), reassign drivers, and adjust queue entries.",
  },
  {
    key: "valet.property.read",
    module: "valet",
    scope: "TENANT",
    description: "View the property/location list.",
  },
  {
    key: "valet.property.manage",
    module: "valet",
    scope: "TENANT",
    description: "Create, edit, or archive properties/locations.",
  },
  {
    key: "valet.driver.read",
    module: "valet",
    scope: "TENANT",
    description: "View the driver list and driver details.",
  },
  {
    key: "valet.driver.manage",
    module: "valet",
    scope: "TENANT",
    description: "Create, edit, or deactivate drivers.",
  },
  {
    key: "valet.card.read",
    module: "valet",
    scope: "TENANT",
    description: "View the NFC card inventory.",
  },
  {
    key: "valet.card.manage",
    module: "valet",
    scope: "TENANT",
    description: "Assign or unassign NFC cards to/from this organization's properties.",
  },
  // #48 platform-scope deck operations: minting new cards from the platform
  // series and running the print/export workflow are Super Admin only. They
  // register with scope PLATFORM so the super-admin platform role picks them up
  // (see registerPermissions' self-healing grant below).
  {
    key: "valet.card.create",
    module: "valet",
    scope: "PLATFORM",
    description: "Mint new NFC cards into the platform deck (single or bulk).",
  },
  {
    key: "valet.card.print",
    module: "valet",
    scope: "PLATFORM",
    description: "Run the card print/export workflow and mark cards printed (freezes UID + property).",
  },
  {
    key: "valet.offer.read",
    module: "valet",
    scope: "TENANT",
    description: "View the offers list.",
  },
  {
    key: "valet.offer.manage",
    module: "valet",
    scope: "TENANT",
    description: "Create, edit, or deactivate offers.",
  },
  {
    key: "valet.reports.read",
    module: "valet",
    scope: "TENANT",
    description: "View and export valet reports.",
  },
];