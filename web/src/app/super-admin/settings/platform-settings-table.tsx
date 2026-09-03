"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddSettingDialog } from "./add-setting-dialog";

export interface PlatformSettingRow {
  key: string;
  category: string;
  value: unknown;
  isSensitive: boolean;
}

export function PlatformSettingsTable({
  settings,
  totalCount,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortDir,
  categoryFilter,
  categoryOptions,
}: {
  settings: PlatformSettingRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy?: string;
  sortDir: "asc" | "desc";
  categoryFilter?: string;
  categoryOptions: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <div className="mb-1 text-[15px] font-extrabold text-[#16213a]">Platform settings</div>
        <p className="mb-4 text-xs text-[#6c7a93]">
          Platform-wide defaults. An organization- or user-level override, where one is set, takes precedence
          over the value here.
        </p>
        <DataTable
          paramPrefix="set_"
          headers={[
            { key: "category", label: "Category", sortable: true },
            { key: "key", label: "Key", sortable: true },
            { key: "value", label: "Value", sortable: true },
            { key: "actions", label: "", className: "text-right" },
          ]}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          sortBy={sortBy}
          sortDir={sortDir}
          searchPlaceholder="Search settings..."
          filters={[
            {
              name: "category",
              value: categoryFilter && categoryFilter !== "all" ? categoryFilter : "",
              label: "Category",
              allLabel: "All categories",
              options: categoryOptions,
            },
          ]}
          rightSlot={<AddSettingDialog />}
        >
          {settings.map((setting) => (
            <tr key={setting.key} className="border-b border-[#f1f3f6] last:border-b-0 hover:bg-[#fafbfc] transition-colors">
              <td className="px-4 py-3 text-[13px] font-bold text-[#1c2b46]">{setting.category}</td>
              <td className="px-4 py-3 text-[13px] font-bold text-[#1c2b46]">{setting.key}</td>
              <td className="px-4 py-3">
                {setting.isSensitive ? (
                  <span
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontWeight: 700, fontSize: 11, background: "#f1f3f6", color: "#6c7a93" }}
                  >
                    Sensitive — redacted
                  </span>
                ) : (
                  <span className="text-[13px] font-bold text-[#1c2b46]">{JSON.stringify(setting.value)}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <EditSettingDialog
                  category={setting.category}
                  keyName={setting.key}
                  isSensitive={setting.isSensitive}
                />
              </td>
            </tr>
          ))}
          {settings.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-[#9aa6bc]">
                No platform settings set yet — click &quot;Add setting&quot; to create one.
              </td>
            </tr>
          ) : null}
        </DataTable>
      </div>
    </div>
  );
}

function EditSettingDialog({
  category,
  keyName,
  isSensitive,
}: {
  category: string;
  keyName: string;
  isSensitive: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Edit ${keyName}`}
              style={{
                cursor: "pointer",
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                background: "rgb(237, 240, 254)",
                color: "rgb(74, 95, 201)",
                padding: "8px 9px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
          }
        >
          <PencilIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
      <AddSettingDialog
        open={open}
        onOpenChange={setOpen}
        defaults={{ category, key: keyName, isSensitive }}
        keyLocked
      />
    </>
  );
}