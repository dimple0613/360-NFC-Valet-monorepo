import type { TaxRate } from "../../generated/client";
import { prismaWithoutTenantScoping } from "../client";
import { getPlatformSetting, setPlatformSetting } from "../settings";

// A basic tax engine (REQUIREMENTS.md §2.17/FR-260-261) — deliberately
// minimal: a global enabled toggle + default rate, with per-country
// overrides. NOT the full VAT/GST/exemption/reverse-charge/tax-profile
// system FR-260 describes — ROADMAP.md defers that as its own initiative;
// this covers just enough to compute Invoice.taxCents.

const TAX_ENABLED_KEY = "tax.enabled";
const TAX_DEFAULT_RATE_KEY = "tax.default_rate_percent";

export interface TaxSettings {
  enabled: boolean;
  defaultRatePercent: number;
}

export async function getTaxSettings(): Promise<TaxSettings> {
  const [enabled, defaultRatePercent] = await Promise.all([
    getPlatformSetting<boolean>(TAX_ENABLED_KEY),
    getPlatformSetting<number>(TAX_DEFAULT_RATE_KEY),
  ]);
  return { enabled: enabled ?? false, defaultRatePercent: defaultRatePercent ?? 0 };
}

export async function setTaxSettings(input: TaxSettings): Promise<void> {
  await Promise.all([
    setPlatformSetting({ category: "tax", key: TAX_ENABLED_KEY, value: input.enabled }),
    setPlatformSetting({ category: "tax", key: TAX_DEFAULT_RATE_KEY, value: input.defaultRatePercent }),
  ]);
}

export async function listTaxRatesByCountry(): Promise<TaxRate[]> {
  return prismaWithoutTenantScoping.taxRate.findMany({ orderBy: { countryCode: "asc" } });
}

export async function setTaxRateForCountry(countryCode: string, ratePercent: number): Promise<TaxRate> {
  return prismaWithoutTenantScoping.taxRate.upsert({
    where: { countryCode },
    create: { countryCode, ratePercent },
    update: { ratePercent },
  });
}

export async function removeTaxRateForCountry(countryCode: string): Promise<void> {
  await prismaWithoutTenantScoping.taxRate.deleteMany({ where: { countryCode } });
}

/** Enabled + (per-country override, falling back to the default rate) — 0 whenever tax is disabled. The one function invoice creation actually calls. */
export async function resolveTaxRatePercent(countryCode: string | null): Promise<number> {
  const settings = await getTaxSettings();
  if (!settings.enabled) return 0;

  if (countryCode) {
    const override = await prismaWithoutTenantScoping.taxRate.findUnique({ where: { countryCode } });
    if (override) return override.ratePercent;
  }
  return settings.defaultRatePercent;
}
