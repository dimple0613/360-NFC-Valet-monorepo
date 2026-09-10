"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormField, FormSelectField } from "@/components/console-form-field";

const SCHEMA = yup.object({
  prefix: yup.string().trim().required("Prefix is required.").matches(/^[A-Za-z]{3}$/, "Exactly 3 letters"),
  from: yup
    .number()
    .typeError("Whole number")
    .integer("Whole number")
    .min(1, "At least 1")
    .required("From is required."),
  to: yup.number().typeError("Whole number").integer("Whole number").min(1, "At least 1").required("To is required."),
  propertyId: yup.string(),
});

export function CreateCardDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
  hideProperty = false,
  properties = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string | null;
  onCreated?: () => void;
  hideProperty?: boolean;
  properties?: { id: number; name: string }[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[17px] font-extrabold text-[#1c2b46]">Create cards</div>
            <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
              Mint cards from the platform deck series. Leave the property empty to add unassigned
              inventory (the org assigns it later).
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#f6f7f9",
              color: "#6c7a93",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="super-console">
          <Formik
            initialValues={{ prefix: "", from: "", to: "", propertyId: "" }}
            validationSchema={SCHEMA}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
              try {
                const body: Record<string, unknown> = {
                  prefix: values.prefix.trim().toUpperCase(),
                  from: Number(values.from),
                  to: Number(values.to),
                  propertyId: values.propertyId ? Number(values.propertyId) : null,
                };
                if (organizationId) body.organizationId = organizationId;
                const res = await fetch("/api/platform/valet/cards", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to create cards");
                toast.success(`Created ${data.created} cards (${data.from} → ${data.to}).`);
                resetForm();
                onOpenChange(false);
                onCreated?.();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FormField name="prefix" label="Prefix" placeholder="e.g. ABC" required />
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <FormField name="from" label="From" placeholder="e.g. 1" type="number" required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FormField name="to" label="To" placeholder="e.g. 25" type="number" required />
                  </div>
                </div>
                {!hideProperty ? (
                  <FormSelectField
                    name="propertyId"
                    label="Property (optional)"
                    options={[{ value: "", label: "Unassigned (deck)" }, ...properties.map((p) => ({ value: String(p.id), label: p.name }))]}
                  />
                ) : null}
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ marginTop: 18, padding: 14, width: "100%", fontSize: 14 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating…" : "Create cards"}
                </button>
              </Form>
            )}
          </Formik>
        </div>
      </DialogContent>
    </Dialog>
  );
}