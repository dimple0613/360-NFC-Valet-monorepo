"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { FormField, FormTextareaField, FormSelectField } from "@/components/console-form-field";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Card, CardContent } from "@/components/ui/card";
import { createPlanVersionAction } from "./actions";

function PlanCheckbox({
  name,
  value,
  defaultChecked,
  className,
  children,
}: {
  name: string;
  value?: string;
  defaultChecked: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label
      className={className ? `checkbox ${className}` : "checkbox"}
      style={{ cursor: "pointer" }}
    >
      <input type="checkbox" name={name} value={value} checked={checked} className="hidden" readOnly />
      <span
        className={`checkbox-box${checked ? " checked" : ""}`}
        onClick={() => setChecked((c) => !c)}
      >
        <Check size={12} strokeWidth={3.5} color="#ffffff" />
      </span>
      {children ? <span className="checkbox-label">{children}</span> : null}
    </label>
  );
}

const PLAN_TYPES = [
  { value: "FREE", label: "Free" },
  { value: "TRIAL", label: "Trial" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "LIFETIME", label: "Lifetime" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

const VISIBILITIES = [
  { value: "PUBLIC", label: "Public — listed for self-serve sign-up" },
  { value: "INVITE_ONLY", label: "Invite only — assignable, not self-serve" },
  { value: "HIDDEN", label: "Hidden — existing subscribers only" },
  { value: "ARCHIVED", label: "Archived — no new subscriptions" },
];

const BILLING_CYCLES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

export interface PlanVersionDefaults {
  key: string;
  name: string;
  type: string;
  description: string | null;
  visibility: string;
  priceDollars: string;
  currency: string;
  billingCycle: string | null;
  trialDays: number | null;
  gracePeriodDays: number;
  resourceLimits: Record<string, string>;
  featureKeys: Set<string>;
  termsOfService: string | null;
  termsOfServiceDisabled: boolean;
}

const BLANK_DEFAULTS: PlanVersionDefaults = {
  key: "",
  name: "",
  type: "",
  description: null,
  visibility: "PUBLIC",
  priceDollars: "",
  currency: "usd",
  billingCycle: null,
  trialDays: null,
  gracePeriodDays: 0,
  resourceLimits: {},
  featureKeys: new Set(),
  termsOfService: null,
  termsOfServiceDisabled: true,
};

const schema = yup.object({
  key: yup.string().required("A plan key is required."),
  name: yup.string().required("A plan name is required."),
  type: yup.string().required("A plan type is required."),
  visibility: yup.string().required(),
  priceDollars: yup.string(),
  currency: yup.string().required(),
  billingCycle: yup.string().nullable(),
  trialDays: yup.string(),
  gracePeriodDays: yup.string(),
  description: yup.string().nullable(),
});

export function PlanVersionForm({
  resourceTypes,
  features,
  currencies,
  defaults = BLANK_DEFAULTS,
  keyLocked = false,
}: {
  resourceTypes: { key: string; displayName: string; unit: string }[];
  features: { key: string; name: string }[];
  currencies: { code: string; name: string }[];
  defaults?: PlanVersionDefaults;
  keyLocked?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "resources" | "tos">("general");

  const TABS = [
    { value: "general", label: "General" },
    { value: "resources", label: "Resources" },
    { value: "tos", label: "Terms of Service" },
  ] as const;

  return (
    <Formik
      initialValues={{
        key: defaults.key,
        name: defaults.name,
        type: defaults.type || "",
        visibility: defaults.visibility,
        description: defaults.description ?? "",
        priceDollars: defaults.priceDollars,
        currency: defaults.currency,
        billingCycle: defaults.billingCycle ?? "",
        trialDays: defaults.trialDays != null ? String(defaults.trialDays) : "",
        gracePeriodDays: String(defaults.gracePeriodDays),
      }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData(formRef.current!);
          fd.set("key", values.key);
          fd.set("name", values.name);
          fd.set("type", values.type);
          fd.set("visibility", values.visibility);
          fd.set("description", values.description);
          fd.set("priceDollars", values.priceDollars);
          fd.set("currency", values.currency);
          fd.set("billingCycle", values.billingCycle);
          fd.set("trialDays", values.trialDays);
          fd.set("gracePeriodDays", values.gracePeriodDays);
          const result = await createPlanVersionAction({ error: null }, fd);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(keyLocked ? "Plan updated." : "Plan created.");
          router.push("/super-admin/plans");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form ref={formRef} className="flex flex-col gap-4" key={defaults.key || "new"}>
          <nav className="-mb-px flex gap-4 overflow-x-auto border-b">
            {TABS.map(({ value, label }) => {
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "whitespace-nowrap border-b-2 border-primary px-1 pb-2.5 text-sm font-bold text-primary"
                      : "whitespace-nowrap border-b-2 border-transparent px-1 pb-2.5 text-sm font-bold text-muted-foreground hover:text-foreground"
                  }
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <Card>
            <CardContent>
              {tab === "general" ? (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField name="key" label="Plan key" placeholder="e.g. pro" disabled={keyLocked} />
                    <FormField name="name" label="Display name" placeholder="e.g. Pro" />
                    <FormSelectField name="type" label="Type" options={PLAN_TYPES} />
                    <FormSelectField name="visibility" label="Visibility" options={VISIBILITIES} />
                  </div>

                  <FormTextareaField name="description" label="Description" rows={2} />

                  <div className="grid gap-4 sm:grid-cols-4">
                    <FormField name="priceDollars" label="Price" type="number" placeholder="0.00" />
                    <FormSelectField name="currency" label="Currency" options={currencies.map((c) => ({ value: c.code, label: c.name }))} />
                    <FormSelectField name="billingCycle" label="Billing cycle" options={BILLING_CYCLES} />
                    <FormField name="trialDays" label="Trial days" type="number" />
                  </div>

                  <FormField name="gracePeriodDays" label="Grace period (days)" type="number" />

                  {features.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-section">Features</div>
                      <div className="flex flex-col gap-1.5 rounded-lg border p-3">
                        {features.map((feature) => (
                          <PlanCheckbox
                            key={feature.key}
                            name="featureKey"
                            value={feature.key}
                            defaultChecked={defaults.featureKeys.has(feature.key)}
                          >
                            {feature.name}
                            <span className="text-xs text-muted-foreground block">({feature.key})</span>
                          </PlanCheckbox>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "resources" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    Set up this plan&apos;s quota to limit the resources subscribers can use.
                  </p>
                  {resourceTypes.length > 0 ? (
                    <div className="flex flex-col gap-2 rounded-lg border p-3">
                      {resourceTypes.map((resource) => {
                        const existingLimit = defaults.resourceLimits[resource.key];
                        return (
                          <div key={resource.key} className="flex items-center gap-3 text-sm">
                            <PlanCheckbox
                              className="flex-1"
                              name="resourceKey"
                              value={resource.key}
                              defaultChecked={existingLimit !== undefined}
                            >
                              {resource.displayName}{" "}
                              <span className="text-xs text-muted-foreground block">({resource.key})</span>
                            </PlanCheckbox>
                            <input
                              name={`resourceLimit_${resource.key}`}
                              type="number"
                              min="0"
                              placeholder="Unlimited"
                              defaultValue={existingLimit ?? ""}
                              className="field-value.input w-32"
                            />
                            <span className="w-14 text-xs text-muted-foreground">{resource.unit}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No resource types registered yet.</p>
                  )}
                </div>
              ) : null}

              {tab === "tos" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Terms of service are the legal agreement between you and a subscriber. Left disabled, no agreement is
                    required for this plan.
                  </p>
                  <PlanCheckbox name="termsOfServiceDisabled" defaultChecked={defaults.termsOfServiceDisabled}>
                    Disable terms of service
                  </PlanCheckbox>
                  <RichTextEditor name="termsOfService" defaultValue={defaults.termsOfService ?? ""} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : keyLocked ? "Save changes" : "Create plan"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
