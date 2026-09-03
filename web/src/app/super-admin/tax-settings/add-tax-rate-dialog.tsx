"use client";

import { useState } from "react";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { PlusIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { addTaxRateAction } from "./actions";

const addRateSchema = yup.object({
  countryCode: yup.string().required("Choose a country."),
  ratePercent: yup.number().min(0, "Must be 0 or more.").required("Enter a rate."),
});

export function AddTaxRateDialog({
  availableCountries,
  onSuccess,
}: {
  availableCountries: { code: string; name: string }[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2"
        style={{
          background: "#f4531f",
          color: "#fff",
          borderRadius: 99,
          padding: "10px 20px",
          fontSize: 12.5,
          fontWeight: 800,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(16,22,35,0.05)",
          transition: "background 0.15s ease",
          border: "none",
          cursor: "pointer",
        }}
      >
        <PlusIcon className="size-4" />
        Add tax rate
      </button>

      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[17px] font-extrabold text-[#1c2b46]">Add tax rate</div>
            <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
              Set a per-country tax rate to override the default.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
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
              position: "absolute",
              right: 10,
              top: 10,
            }}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="super-console">
          <Formik
            initialValues={{ countryCode: "", ratePercent: 0 }}
            validationSchema={addRateSchema}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
              try {
                const fd = new FormData();
                fd.append("countryCode", values.countryCode);
                fd.append("ratePercent", String(values.ratePercent));
                await addTaxRateAction(fd);
                toast.success("Tax rate saved.");
                resetForm();
                setOpen(false);
                onSuccess();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="flex flex-col gap-3">
                <FormSelectField
                  name="countryCode"
                  label="Country"
                  placeholder="Choose"
                  required
                  options={availableCountries.map((c) => ({ value: c.code, label: c.name }))}
                />
                <FormField name="ratePercent" label="Rate %" type="number" required />
                <button type="submit" className="btn-primary mt-1" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Add tax rate"}
                </button>
              </Form>
            )}
          </Formik>
        </div>
      </DialogContent>
    </Dialog>
  );
}