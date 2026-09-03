import { Suspense } from "react";
import { listPlatformSettings } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { parseListQueryParams } from "@/lib/list-query-params";
import { PlatformSettingsTable } from "./platform-settings-table";

export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.manage_settings");
  const rawParams = await searchParams;
  const settings = await listPlatformSettings();

  const params = parseListQueryParams(rawParams, "set_");
  const categoryFilter = Array.isArray(rawParams["set_category"])
    ? rawParams["set_category"][0]
    : rawParams["set_category"];

  const filtered = settings
    .filter((setting) => {
      if (categoryFilter && categoryFilter !== "all" && setting.category !== categoryFilter) return false;
      const q = params.q?.trim().toLowerCase();
      if (q && !`${setting.category} ${setting.key}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const factor = (params.sortDir ?? "asc") === "asc" ? 1 : -1;
      if (params.sortBy === "key") return a.key.localeCompare(b.key) * factor;
      if (params.sortBy === "value") return String(a.value).localeCompare(String(b.value)) * factor;
      return a.category.localeCompare(b.category) * factor;
    });

  const pageSize = params.pageSize ?? 15;
  const page = params.page ?? 1;
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const categoryOptions = [...new Set(settings.map((s) => s.category))].map((c) => ({
    value: c,
    label: c,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="min-h-40" />}>
        <PlatformSettingsTable
          settings={paged}
          totalCount={totalCount}
          page={safePage}
          pageSize={pageSize}
          totalPages={totalPages}
          sortBy={params.sortBy}
          sortDir={params.sortDir ?? "asc"}
          categoryFilter={categoryFilter}
          categoryOptions={categoryOptions}
        />
      </Suspense>
    </div>
  );
}