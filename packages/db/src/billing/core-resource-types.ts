import type { ResourceTypeDefinition } from "./resource-types";

// FR-170: core's own resource type manifest — deliberately small (mirrors
// core-permissions.ts), covering what the DoD scenario actually needs
// (a seat quota to demonstrate enforcement), not a speculative full catalog.
export const CORE_RESOURCE_TYPES: ResourceTypeDefinition[] = [
  {
    key: "core.seats",
    module: "core",
    displayName: "Team members",
    unit: "seats",
    aggregation: "GAUGE",
    resetCycle: "NEVER",
    overagePolicy: "BLOCK",
    description: "Active organization members.",
  },
  {
    key: "core.api_requests",
    module: "core",
    displayName: "API requests",
    unit: "requests",
    aggregation: "COUNTER",
    resetCycle: "MONTHLY",
    overagePolicy: "BILL",
    description: "API requests made this billing period.",
  },
  {
    key: "core.storage_gb",
    module: "core",
    displayName: "Storage",
    unit: "GB",
    aggregation: "GAUGE",
    resetCycle: "NEVER",
    overagePolicy: "BLOCK",
    description: "Total storage currently in use.",
  },
];
