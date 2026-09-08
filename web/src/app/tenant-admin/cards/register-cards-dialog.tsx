"use client";

import { useState } from "react";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { PlusIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { useRouter } from "next/navigation";

const SCHEMA = yup.object({
  count: yup.number().typeError("Whole number").min(1, "At least 1").required("Count is required.").max(500, "At most 500 per batch"),
  propertyId: yup.string(),
});

export function RegisterCardsDialog({ fields }: { fields: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
        Create cards
      </button>
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
            initialValues={{ count: "", propertyId: "" }}
            validationSchema={SCHEMA}
            onSubmit={async (values, { setSubmitting }) => {
              try {
                const res = await fetch("/api/platform/valet/cards", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    count: Number(values.count),
                    propertyId: values.propertyId ? Number(values.propertyId) : null,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to create cards");
                toast.success(`Created ${data.created} cards (${data.from} → ${data.to}).`);
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Something went wrong.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FormField name="count" label="Number of cards" placeholder="e.g. 25" />
                <FormSelectField
                  name="propertyId"
                  label="Property (optional)"
                  options={[{ value: "", label: "Unassigned (deck)" }, ...fields.map((p) => ({ value: String(p.id), label: p.name }))]}
                />
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