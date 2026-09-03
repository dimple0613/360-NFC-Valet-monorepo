"use client";

import { useState } from "react";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { PencilIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormField } from "@/components/console-form-field";
import { addTaxRateAction } from "./actions";

const editRateSchema = yup.object({
  ratePercent: yup.number().min(0, "Must be 0 or more.").required("Enter a rate."),
});

export function EditTaxRateDialog({
  countryCode,
  countryName,
  ratePercent,
}: {
  countryCode: string;
  countryName: string | undefined;
  ratePercent: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`Edit ${countryName ?? countryCode} tax rate`}
              onClick={() => setOpen(true)}
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

      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[17px] font-extrabold text-[#1c2b46]">Edit tax rate</div>
            <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
              Update the tax rate for {countryName ?? countryCode}.
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
            initialValues={{ ratePercent }}
            validationSchema={editRateSchema}
            onSubmit={async (values, { setSubmitting }) => {
              try {
                const fd = new FormData();
                fd.append("countryCode", countryCode);
                fd.append("ratePercent", String(values.ratePercent));
                await addTaxRateAction(fd);
                toast.success("Tax rate updated.");
                setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="flex flex-col gap-3">
                <FormField
                  name="ratePercent"
                  label="Rate %"
                  type="number"
                  required
                  placeholder="e.g. 13"
                />
                <button type="submit" className="btn-primary mt-1" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Update tax rate"}
                </button>
              </Form>
            )}
          </Formik>
        </div>
      </DialogContent>
    </Dialog>
  );
}