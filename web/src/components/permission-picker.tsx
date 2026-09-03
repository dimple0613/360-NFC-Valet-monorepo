"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { groupPermissions, titleCase, type PermissionDef } from "@/lib/group-permissions";

interface PickerItem extends PermissionDef {
  id: string;
}

/**
 * Grouped, searchable-by-scroll permission/scope checkbox grid with a
 * per-group "select all" — shared between the API-keys scope picker (value =
 * permission key, e.g. "core.roles.manage") and the role permission picker
 * (value = permission id, since setRolePermissions takes ids) via `valueField`.
 */
export function PermissionPicker({
  catalog,
  inputName,
  valueField,
  defaultSelected,
}: {
  catalog: PickerItem[];
  inputName: string;
  valueField: "id" | "key";
  defaultSelected?: Set<string>;
}) {
  const groups = useMemo(() => groupPermissions(catalog), [catalog]);
  const [selected, setSelected] = useState<Set<string>>(defaultSelected ?? new Set());

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleGroup(items: PickerItem[]) {
    const values = items.map((item) => item[valueField]);
    const allSelected = values.every((v) => selected.has(v));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const v of values) {
        if (allSelected) next.delete(v);
        else next.add(v);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const allSelected = group.permissions.every((p) => selected.has(p[valueField]));
        return (
          <div key={group.resource} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{group.label}</span>
              <button
                type="button"
                onClick={() => toggleGroup(group.permissions)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {group.permissions.map((permission) => {
                const value = permission[valueField];
                const checked = selected.has(value);
                return (
                  <label key={permission.id} className="checkbox" style={{ alignItems: "flex-start" }}>
                    <input
                      type="checkbox"
                      name={inputName}
                      value={value}
                      checked={checked}
                      onChange={() => toggle(value)}
                      className="hidden"
                    />
                    <span className={`checkbox-box${checked ? " checked" : ""}`} onClick={() => toggle(value)}>
                      <Check size={12} strokeWidth={3.5} color="#ffffff" />
                    </span>
                    <span className="checkbox-label">
                      {titleCase(permission.key.split(".")[2] ?? permission.key)}
                      {permission.description ? (
                        <span className="block font-medium text-[12px] text-[#6c7a93]" style={{ fontWeight: 500 }}>
                          {permission.description}
                        </span>
                      ) : null}
                      <span className="block text-xs text-muted-foreground">{permission.key}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
