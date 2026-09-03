export interface PermissionDef {
  key: string;
  description: string | null;
}

export function titleCase(segment: string): string {
  return segment.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Groups a flat "core.<resource>.<action>" permission catalog by resource, for a scoped picker instead of one long checkbox list. Shared between the API keys scope picker and the role permission picker. */
export function groupPermissions<T extends PermissionDef>(
  permissions: T[],
): { resource: string; label: string; permissions: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const permission of permissions) {
    const resource = permission.key.split(".")[1] ?? "other";
    if (!groups.has(resource)) groups.set(resource, []);
    groups.get(resource)!.push(permission);
  }
  return Array.from(groups.entries())
    .map(([resource, permissions]) => ({ resource, label: titleCase(resource), permissions }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
