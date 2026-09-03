import { Suspense } from "react";
import { PercentIcon } from "lucide-react";
import { getTaxSettings, listTaxRatesByCountry } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { COUNTRIES } from "@/lib/countries";
import { parseListQueryParams } from "@/lib/list-query-params";
import { TaxSettingsForms } from "./tax-settings-forms";

const countryNameByCode = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export default async function TaxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.manage_plans");
  const rawParams = await searchParams;
  const [settings, rates] = await Promise.all([getTaxSettings(), listTaxRatesByCountry()]);

  const params = parseListQueryParams(rawParams, "tax_");
  const countryFilter = Array.isArray(rawParams["tax_countryCode"])
    ? rawParams["tax_countryCode"][0]
    : rawParams["tax_countryCode"];

  const countryName = (code: string) => countryNameByCode.get(code) ?? code;

  const filtered = rates
    .filter((rate) => {
      if (countryFilter && countryFilter !== "all" && rate.countryCode !== countryFilter) return false;
      const q = params.q?.trim().toLowerCase();
      if (q && !countryName(rate.countryCode).toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const factor = (params.sortDir ?? "asc") === "asc" ? 1 : -1;
      if (params.sortBy === "rate") return (a.ratePercent - b.ratePercent) * factor;
      return countryName(a.countryCode).localeCompare(countryName(b.countryCode)) * factor;
    });

  const pageSize = params.pageSize ?? 15;
  const page = params.page ?? 1;
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const usedCodes = new Set(rates.map((r) => r.countryCode));
  const availableCountries = COUNTRIES.filter((c) => !usedCodes.has(c.code));
  const countryFilterOptions = rates.map((r) => ({
    value: r.countryCode,
    label: countryName(r.countryCode),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PercentIcon className="size-5" />}
        title="Tax Settings"
        description="Default and per-country VAT/GST rates applied when generating invoices."
      />
      <Suspense fallback={<div className="min-h-40" />}>
        <TaxSettingsForms
          settings={settings}
          rates={paged}
          totalCount={totalCount}
          page={safePage}
          pageSize={pageSize}
          totalPages={totalPages}
          sortBy={params.sortBy}
          sortDir={params.sortDir ?? "asc"}
          countryFilter={countryFilter}
          countryFilterOptions={countryFilterOptions}
          availableCountries={availableCountries}
        />
      </Suspense>
    </div>
  );
}