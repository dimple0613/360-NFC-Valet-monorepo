"use client";

import { useId, useState } from "react";
import { useField, Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { EyeIcon, UploadIcon } from "lucide-react";
import { FormField, FormSelectField, FormTextareaField, FormToggleField } from "@/components/console-form-field";

const CATEGORIES = ["Dining", "Spa", "Deals", "Stay", "Gym", "Entertainment", "Pool", "Concierge", "Room Service", "Events"];

const SCHEMA = yup.object({
  title: yup.string().required("Title is required."),
  category: yup.string(),
  price: yup.number().typeError("Enter a number").min(0, "Must be 0 or more").required("Price is required."),
  wasPrice: yup.number().typeError("Enter a number").min(0, "Must be 0 or more"),
  propertyId: yup.string(),
  imageUrl: yup.string().test("url-or-data", "Enter a valid URL", (v) => !v || v.startsWith("data:") || yup.string().url().isValidSync(v)),
  menuUrl: yup.string().test("url-or-data", "Enter a valid URL", (v) => !v || v.startsWith("data:") || yup.string().url().isValidSync(v)),
  desc: yup.string(),
  validatesValet: yup.boolean(),
  staffCode: yup
    .string()
    .test("four-digits", "Staff validation code must be exactly 4 digits", (v) => !v || /^\d{4}$/.test(String(v).trim())),
});

export interface OfferFormDefaults {
  title: string;
  category: string;
  price: string;
  wasPrice: string;
  propertyId: string;
  imageUrl: string;
  menuUrl: string;
  desc: string;
  validatesValet: boolean;
  staffCodeConfigured: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (file.size > 5 * 1024 * 1024) return reject(new Error("File must be under 5 MB"));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const ICON_BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 20,
  height: 20,
  padding: 0,
  borderRadius: 6,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#6c7a93",
};

const HIDDEN_FILE: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  opacity: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

function OfferImageUpload() {
  const fileId = useId();
  const [field, meta, helpers] = useField("imageUrl");
  const [previewOpen, setPreviewOpen] = useState(false);
  const value = String(field.value || "");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      helpers.setValue(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      if (e.target) e.target.value = "";
      setPreviewOpen(false);
    }
  };

  return (
    <div>
      <div className="field">
        <label className="field-label">Offer image (optional)</label>
        <label
          htmlFor={value ? undefined : fileId}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, cursor: value ? "default" : "pointer" }}
        >
          <input
            className="field-value input"
            readOnly
            placeholder="Upload image (JPG/PNG)"
            value={value ? "Image attached" : ""}
            style={{ flex: 1, minWidth: 0, paddingRight: 40, cursor: value ? "default" : "pointer", pointerEvents: "none" }}
          />
          {value ? (
            <button
              type="button"
              aria-label={previewOpen ? "Hide preview" : "Show preview"}
              onClick={() => setPreviewOpen((o) => !o)}
              style={ICON_BTN}
            >
              <EyeIcon size={16} strokeWidth={2} />
            </button>
          ) : (
            <span style={ICON_BTN} aria-hidden="true">
              <UploadIcon size={16} strokeWidth={2} />
            </span>
          )}
        </label>
      </div>
      {previewOpen && value ? (
        <>
          <div
            style={{
              marginTop: 8,
              border: "1.5px dashed #C3CAD6",
              borderRadius: 12,
              padding: 8,
              background: "none",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-label="Offer preview"
              style={{
                width: "100%",
                height: 180,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundImage: value.startsWith("data:") ? `url("${value}")` : `url(${value})`,
                borderRadius: 10,
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              helpers.setValue("");
              setPreviewOpen(false);
            }}
            style={{
              marginTop: 6,
              border: "1px solid #e7eaf0",
              background: "#fff",
              color: "#d6430f",
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 12px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Remove image
          </button>
        </>
      ) : null}
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
      <input id={fileId} type="file" accept="image/*" onChange={handleFile} tabIndex={-1} aria-hidden="true" style={HIDDEN_FILE} />
    </div>
  );
}

function OfferMenuUpload() {
  const fileId = useId();
  const [field, meta, helpers] = useField("menuUrl");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuName, setMenuName] = useState("");
  const value = String(field.value || "");
  const isImage = value.startsWith("data:image");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setMenuName(file.name);
      helpers.setValue(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      if (e.target) e.target.value = "";
      setPreviewOpen(false);
    }
  };

  return (
    <div>
      <div className="field">
        <label className="field-label">Menu / PDF (optional)</label>
        <label
          htmlFor={value ? undefined : fileId}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, cursor: value ? "default" : "pointer" }}
        >
          <input
            className="field-value input"
            readOnly
            placeholder="Upload menu (PDF or image)"
            value={menuName || (value ? "Menu attached" : "")}
            style={{ flex: 1, minWidth: 0, paddingRight: 40, cursor: value ? "default" : "pointer", pointerEvents: "none" }}
          />
          {value ? (
            <button
              type="button"
              aria-label={previewOpen ? "Hide preview" : "Show preview"}
              onClick={() => setPreviewOpen((o) => !o)}
              style={ICON_BTN}
            >
              <EyeIcon size={16} strokeWidth={2} />
            </button>
          ) : (
            <span style={ICON_BTN} aria-hidden="true">
              <UploadIcon size={16} strokeWidth={2} />
            </span>
          )}
        </label>
      </div>
      {previewOpen && value ? (
        <>
          <div
            style={{
              marginTop: 8,
              border: "1.5px dashed #C3CAD6",
              borderRadius: 12,
              padding: 8,
              background: isImage ? "none" : "#FEEFE8",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {isImage ? (
              <div
                aria-label="Menu preview"
                style={{
                  width: "100%",
                  height: 180,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundImage: `url("${value}")`,
                  borderRadius: 10,
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 60, padding: "0 4px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4531F" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M12 18v-6" />
                  <path d="M9 15h6" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#D6430F" }}>
                    {menuName || (value.startsWith("data:") ? "Menu attached" : "Current menu attached")}
                  </div>
                  <div style={{ fontSize: 10, color: "#6C7A93", fontWeight: 600 }}>File attached</div>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              helpers.setValue("");
              setMenuName("");
              setPreviewOpen(false);
            }}
            style={{
              marginTop: 6,
              border: "1px solid #e7eaf0",
              background: "#fff",
              color: "#d6430f",
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 12px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Remove menu
          </button>
        </>
      ) : null}
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
      <input id={fileId} type="file" accept="image/*,.pdf" onChange={handleFile} tabIndex={-1} aria-hidden="true" style={HIDDEN_FILE} />
    </div>
  );
}

function StaffCodeField({ configured }: { configured: boolean }) {
  const [field, meta, helpers] = useField("staffCode");
  const showHint = configured && !(meta.touched && meta.error);
  return (
    <div>
      <div className="field">
        <label className="field-label" htmlFor="staffCode">
          Staff validation code
        </label>
        <input
          id="staffCode"
          name="staffCode"
          className="field-value input"
          placeholder={configured ? "Keep current code" : "4 digits"}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={field.value}
          onChange={(e) => helpers.setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          onBlur={field.onBlur}
          style={{ letterSpacing: 4, fontVariantNumeric: "tabular-nums" }}
        />
      </div>
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
      {showHint ? (
        <div style={{ fontSize: 11, fontWeight: 500, color: "#6c7a93", marginTop: 4 }}>
          This offer already has a code. Enter a new 4-digit code to replace it — codes are never shown again.
        </div>
      ) : null}
    </div>
  );
}

export function OfferForm({
  offerId,
  defaults,
  fields,
  onSuccess,
  submitLabel,
}: {
  offerId?: number;
  defaults?: OfferFormDefaults;
  fields: { id: number; name: string }[];
  onSuccess?: () => void;
  submitLabel: string;
}) {
  return (
    <Formik
      initialValues={{
        title: defaults?.title ?? "",
        category: defaults?.category ?? "",
        price: defaults?.price ?? "",
        wasPrice: defaults?.wasPrice ?? "",
        propertyId: defaults?.propertyId ?? "",
        imageUrl: defaults?.imageUrl ?? "",
        menuUrl: defaults?.menuUrl ?? "",
        desc: defaults?.desc ?? "",
        validatesValet: defaults?.validatesValet ?? true,
        staffCode: "",
      }}
      validationSchema={SCHEMA}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const url = "/api/platform/valet/offers";
          const method = offerId ? "PATCH" : "POST";
          const body = {
            ...(offerId ? { id: offerId } : {}),
            title: values.title,
            category: values.category || null,
            price: values.price,
            wasPrice: values.wasPrice === "" ? null : values.wasPrice,
            propertyId: values.propertyId || null,
            imageUrl: values.imageUrl || null,
            menuUrl: values.menuUrl || null,
            desc: values.desc || null,
            validatesValet: values.validatesValet,
            staffCode:
              !values.validatesValet
                ? null
                : values.staffCode
                ? values.staffCode.trim()
                : offerId
                ? undefined
                : null,
          };
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to save offer");
          toast.success(offerId ? "Offer updated." : "Offer created.");
          if (onSuccess) onSuccess();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting, values }) => {
        return (
          <Form style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FormField name="title" label="Title" placeholder="e.g. Friday Brunch at Kitchen6" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormSelectField
                name="category"
                label="Category"
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
              <FormSelectField
                name="propertyId"
                label="Property"
                options={[{ value: "", label: "No property" }, ...fields.map((p) => ({ value: String(p.id), label: p.name }))]}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField name="price" label="Price (AED)" placeholder="0.00" />
              <FormField name="wasPrice" label="Was price (AED)" placeholder="0.00" />
            </div>

            {/* Validates-valet toggle hidden until client approval */}
            <div style={{ display: "none" }}>
              <FormToggleField
                name="validatesValet"
                label="Validates valet parking"
                description="Guests redeem staff-code validated, fee-free parking."
              />
              {values.validatesValet && <StaffCodeField configured={Boolean(defaults?.staffCodeConfigured)} />}
            </div>

            <OfferImageUpload />

            <OfferMenuUpload />

            <FormTextareaField name="desc" label="Description" placeholder="Short description shown to guests" />
            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: 18, padding: 14, width: "100%", fontSize: 14 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          </Form>
        );
      }}
    </Formik>
  );
}
