"use client";

import { useState } from "react";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormField, FormToggleField } from "@/components/console-form-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable } from "@/components/data-table";
import { COUNTRIES } from "@/lib/countries";
import { setTaxSettingsAction, removeTaxRateAction } from "./actions";
import { AddTaxRateDialog } from "./add-tax-rate-dialog";
import { EditTaxRateDialog } from "./edit-tax-rate-dialog";

const countryNameByCode = new Map(COUNTRIES.map((c) => [c.code, c.name]));

const settingsSchema = yup.object({
  enabled: yup.boolean(),
  defaultRatePercent: yup.number().min(0, "Must be 0 or more.").required("Required."),
});

export function TaxSettingsForms({
  settings,
  rates,
  totalCount,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortDir,
  countryFilter,
  countryFilterOptions,
  availableCountries,
}: {
  settings: { enabled: boolean; defaultRatePercent: number };
  rates: { id: string; countryCode: string; ratePercent: number }[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy?: string;
  sortDir: "asc" | "desc";
  countryFilter?: string;
  countryFilterOptions: { value: string; label: string }[];
  availableCountries: { code: string; name: string }[];
}) {
  const [tab, setTab] = useState<"default" | "bycountry">("default");

  return (
    <div className="flex flex-col gap-6">
      <nav className="-mb-px flex gap-4 overflow-x-auto border-b">
        {[
          { value: "default" as const, label: "Default rate" },
          { value: "bycountry" as const, label: "Tax by country" },
        ].map(({ value, label }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(value)}
              className={cn(
                "whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-bold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {tab === "default" ? (
        <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
          <div className="mb-4 text-[15px] font-extrabold text-[#16213a]">Default tax rate</div>
          <Formik
            initialValues={{ enabled: settings.enabled, defaultRatePercent: settings.defaultRatePercent }}
            validationSchema={settingsSchema}
            onSubmit={async (values, { setSubmitting }) => {
              try {
                const fd = new FormData();
                if (values.enabled) fd.append("enabled", "on");
                fd.append("defaultRatePercent", String(values.defaultRatePercent));
                await setTaxSettingsAction(fd);
                toast.success("Tax settings saved.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="flex flex-col gap-3">
                <FormToggleField name="enabled" label="Enable tax" description="Specify a tax rate to apply to all your users' payments." />
                <div className="flex items-end gap-2">
                  <FormField name="defaultRatePercent" label="Default tax rate" type="number" />
                  <span className="text-sm text-[#6c7a93]">%</span>
                  <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Set"}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      ) : null}

      {tab === "bycountry" ? (
        <DataTable
          paramPrefix="tax_"
          headers={[
            { key: "country", label: "Country", sortable: true },
            { key: "rate", label: "Tax rate", sortable: true },
            { key: "actions", label: "", className: "text-right" },
          ]}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          sortBy={sortBy}
          sortDir={sortDir}
          searchPlaceholder="Search tax rates..."
          filters={[
            {
              name: "countryCode",
              value: countryFilter && countryFilter !== "all" ? countryFilter : "",
              label: "Country",
              allLabel: "All countries",
              options: countryFilterOptions,
            },
          ]}
          rightSlot={<AddTaxRateDialog availableCountries={availableCountries} onSuccess={() => {}} />}
        >
          {rates.map((rate) => (
            <tr key={rate.id} className="border-b border-[#f1f3f6] last:border-b-0 hover:bg-[#fafbfc] transition-colors">
              <td className="px-4 py-3">
                <div className="text-[13px] font-bold text-[#1c2b46]">
                  {countryNameByCode.get(rate.countryCode) ?? rate.countryCode}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="text-[13px] font-bold text-[#1c2b46]">{rate.ratePercent}%</div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <EditTaxRateDialog
                    countryCode={rate.countryCode}
                    countryName={countryNameByCode.get(rate.countryCode)}
                    ratePercent={rate.ratePercent}
                  />
                  <Formik
                    initialValues={{}}
                    onSubmit={async (_, { setSubmitting }) => {
                      try {
                        await removeTaxRateAction(rate.countryCode);
                        toast.success("Tax rate removed.");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Something went wrong.");
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    {({ isSubmitting }) => (
                      <Form>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="submit"
                                aria-label={`Remove ${countryNameByCode.get(rate.countryCode) ?? rate.countryCode} tax rate`}
                                disabled={isSubmitting}
                                style={{
                                  cursor: "pointer",
                                  border: "none",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: "rgb(254, 239, 232)",
                                  color: "rgb(214, 67, 15)",
                                  padding: "8px 9px",
                                  borderRadius: 999,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              />
                            }
                          >
                            <Trash2Icon className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>Remove</TooltipContent>
                        </Tooltip>
                      </Form>
                    )}
                  </Formik>
                </div>
              </td>
            </tr>
          ))}
          {rates.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-[13px] text-[#9aa6bc]">
                No per-country overrides yet. Click &quot;Add tax rate&quot; to create one.
              </td>
            </tr>
          ) : null}
        </DataTable>
      ) : null}
    </div>
  );
}
