"use client";

import { useRef, useState } from "react";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormSelectField, FormTextareaField } from "@/components/console-form-field";

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
  const imageRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(defaults?.imageUrl || null);
  const [menuPreview, setMenuPreview] = useState<string | null>(
    defaults?.menuUrl && String(defaults.menuUrl).startsWith("data:") ? String(defaults.menuUrl) : null
  );
  const [menuName, setMenuName] = useState(
    defaults?.menuUrl && !String(defaults.menuUrl).startsWith("data:") ? "Current menu attached" : ""
  );

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
      {({ isSubmitting, values, setFieldValue }) => {
        const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const dataUrl = await fileToDataUrl(file);
            setImagePreview(dataUrl);
            setFieldValue("imageUrl", dataUrl);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to read file");
          } finally {
            if (e.target) e.target.value = "";
          }
        };
        const clearImage = () => {
          setImagePreview(null);
          setFieldValue("imageUrl", "");
        };
        const handleMenu = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const dataUrl = await fileToDataUrl(file);
            setMenuPreview(dataUrl);
            setMenuName(file.name);
            setFieldValue("menuUrl", dataUrl);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to read file");
          } finally {
            if (e.target) e.target.value = "";
          }
        };
        const clearMenu = () => {
          setMenuPreview(null);
          setMenuName("");
          setFieldValue("menuUrl", "");
        };
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

            <div>
              <span className="field-label" style={{ fontSize: 12, fontWeight: 800, color: "#48566e", marginBottom: 6, display: "block" }}>
                Offer image
              </span>
              <div
                onClick={() => imageRef.current?.click()}
                style={{
                  border: "1.5px dashed #C3CAD6",
                  borderRadius: 12,
                  padding: imagePreview ? 8 : "18px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: imagePreview ? 120 : 76,
                  background: imagePreview ? "none" : "#F8F9FB",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Offer"
                    style={{ width: "100%", height: "auto", maxHeight: 180, objectFit: "cover", borderRadius: 10 }}
                  />
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6C7A93" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#6C7A93" }}>
                      Click to upload offer image (JPG/PNG, max 5 MB)
                    </span>
                  </>
                )}
              </div>
              {imagePreview && (
                <button
                  type="button"
                  onClick={clearImage}
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
              )}
              <input ref={imageRef} type="file" accept="image/*" hidden onChange={handleImage} />
            </div>

            <div>
              <span className="field-label" style={{ fontSize: 12, fontWeight: 800, color: "#48566e", marginBottom: 6, display: "block" }}>
                Menu / PDF
              </span>
              <div
                onClick={() => menuRef.current?.click()}
                style={{
                  border: "1.5px dashed #C3CAD6",
                  borderRadius: 12,
                  padding: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: menuPreview ? "#FEEFE8" : "#F8F9FB",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={menuPreview ? "#F4531F" : "#6C7A93"} strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M12 18v-6" />
                  <path d="M9 15h6" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: menuPreview ? "#D6430F" : "#1C2B46" }}>
                    {menuName || "Upload menu (PDF or image)"}
                  </div>
                  <div style={{ fontSize: 10, color: "#6C7A93", fontWeight: 600 }}>
                    {menuPreview ? "File attached" : "Guests can view your menu from the offer detail page"}
                  </div>
                </div>
              </div>
              <input ref={menuRef} type="file" accept="image/*,.pdf" hidden onChange={handleMenu} />
            </div>

            {values.imageUrl && !String(values.imageUrl).startsWith("data:") ? (
              <FormField name="imageUrl" label="Image URL" placeholder="https://…" />
            ) : null}
            {values.menuUrl && !String(values.menuUrl).startsWith("data:") ? (
              <FormField name="menuUrl" label="Menu URL" placeholder="https://…" />
            ) : null}

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
