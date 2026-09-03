"use client";

import { useCallback, useEffect, useState } from "react";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { BuildingIcon, ChevronRight, TrashIcon, LoadingIcon } from "@/app/tenant-admin/_components/valet-icons";
import { PlusIcon, MapPinIcon } from "lucide-react";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";

const POOLS = [100, 200, 400, 800];

const SCHEMA = yup.object({
  name: yup.string().required("Name is required."),
  area: yup.string().required("Area / city is required."),
  zones: yup.number().typeError("Zones must be a number.").integer("Zones must be a whole number.").min(1).max(50).required(),
  slots: yup.number().typeError("Slots must be a number.").integer("Slots must be a whole number.").min(1).max(5000).required(),
  cards: yup.number().oneOf(POOLS, "Select a card pool.").required(),
});

interface Zone {
  id: number;
  code: string;
  slots: number;
}

interface Property {
  id: number;
  name: string;
  area: string;
  slug: string;
  uidStart?: string | null;
  imageUrl?: string | null;
  drivers: number;
  slots: number;
  zonesCount: number;
  cardPool: number;
  occupied: number;
  overdue: number;
  zones: Zone[];
}

interface LocationsData {
  nextUid: string;
  properties: Property[];
}

function guestSlug(name: string, fallback: string): string {
  return name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : fallback;
}

const panelStyle: React.CSSProperties = {
  width: 360,
  flex: "none",
  alignSelf: "flex-start",
  padding: 24,
  borderRadius: 20,
  background: "#fff",
  border: "1px solid #E7EAF0",
};

function GuestUrlRow({ value, fallback }: { value: string; fallback: string }) {
  return (
    <div
      className="field"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="field-label">Guest page URL</div>
        <div
          style={{
            color: "#F4531F",
            fontSize: 14,
            fontWeight: 700,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          tap.360valet.ae/{guestSlug(value, fallback)}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#0C9D61", flex: "none" }}>✓ free</span>
    </div>
  );
}

function CreateLocationForm({ nextUid, onCreated }: { nextUid: string; onCreated: () => void }) {
  return (
    <Formik
      initialValues={{ name: "", area: "", zones: 4, slots: 160, cards: 200, imageUrl: "" }}
      validationSchema={SCHEMA}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        try {
          const res = await fetch("/api/platform/valet/locations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: values.name,
              area: values.area,
              zones: Number(values.zones),
              slots: Number(values.slots),
              cards: Number(values.cards),
              imageUrl: values.imageUrl || null,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to create location");
          toast.success(`${data.name} created`);
          resetForm();
          onCreated();
        } catch (err: any) {
          toast.error(err.message);
          setSubmitting(false);
        }
      }}
    >
      {(formik) => (
        <Form id="loc-form" noValidate>
          <div style={panelStyle}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1C2B46" }}>New location</div>
            <div style={{ fontSize: 12, color: "#6C7A93", fontWeight: 500, marginTop: 4 }}>
              Creates the property, its NFC web page and card pool.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 18 }}>
              <FormField name="name" label="Hotel / Center name" placeholder="Marriott Resort Palm Jumeirah" />
              <FormField name="area" label="Area / City" placeholder="Palm Jumeirah, Dubai" />
              <FormField name="imageUrl" label="Image URL (optional)" placeholder="https://example.com/hotel.jpg" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <FormField name="zones" label="Zones" type="number" />
                <FormField name="slots" label="Slots" type="number" />
              </div>
              <FormSelectField
                name="cards"
                label="Card pool"
                options={POOLS.map((n) => ({
                  value: String(n),
                  label: `Assign ${n} cards · UID ${nextUid}–${Number(nextUid) + n - 1}`,
                }))}
              />
              <GuestUrlRow value={formik.values.name} fallback="new-location" />
            </div>
            <button className="btn-primary" type="submit" style={{ marginTop: 18, padding: 14, width: "100%", fontSize: 14 }} disabled={formik.isSubmitting}>
              {formik.isSubmitting ? "Creating…" : "Create location"}
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

function UpdateLocationForm({ location, onUpdated, onRemove }: { location: Property; onUpdated: () => void; onRemove: (loc: Property) => void }) {
  const nextUid = location.uidStart ?? "0";
  return (
    <Formik
      initialValues={{
        name: location.name,
        area: location.area,
        zones: location.zonesCount,
        slots: location.slots,
        cards: location.cardPool,
        imageUrl: location.imageUrl || "",
      }}
      enableReinitialize
      validationSchema={SCHEMA}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const res = await fetch(`/api/platform/valet/locations/${location.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: values.name,
              area: values.area,
              zones: Number(values.zones),
              slots: Number(values.slots),
              cards: Number(values.cards),
              imageUrl: values.imageUrl || null,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to update location");
          toast.success("Location updated.");
          onUpdated();
        } catch (err: any) {
          toast.error(err.message);
          setSubmitting(false);
        }
      }}
    >
      {(formik) => (
        <div id="loc-form" style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: "#FEEFE8",
                  color: "#F4531F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <BuildingIcon size={22} color="#F4531F" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1C2B46" }}>Update location</div>
                <div style={{ fontSize: 12, color: "#6C7A93", fontWeight: 600, marginTop: 2 }}>{location.name}</div>
              </div>
            </div>
            <button
              type="button"
              title="Remove location"
              onClick={() => onRemove(location)}
              disabled={formik.isSubmitting}
              style={{
                width: 38,
                height: 38,
                borderRadius: 99,
                background: "#FDF0F0",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <TrashIcon size={17} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 18 }}>
            <FormField name="name" label="Hotel / Center name" />
            <FormField name="area" label="Area / City" />
            <FormField name="imageUrl" label="Image URL (optional)" placeholder="https://example.com/hotel.jpg" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              <FormField name="zones" label="Zones" type="number" />
              <FormField name="slots" label="Slots" type="number" />
            </div>
            <FormSelectField
              name="cards"
              label="Card pool"
              options={POOLS.map((n) => ({
                value: String(n),
                label: `Assign ${n} cards · UID ${nextUid}–${Number(nextUid) + n - 1}`,
              }))}
            />
            <GuestUrlRow value={formik.values.name} fallback={location.slug} />
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 18, padding: 14, width: "100%", fontSize: 14 }}
            onClick={() => formik.submitForm()}
            disabled={formik.isSubmitting}
          >
            {formik.isSubmitting ? "Saving…" : "Update location"}
          </button>
        </div>
      )}
    </Formik>
  );
}

export default function LocationsManager() {
  const [data, setData] = useState<LocationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (): Promise<LocationsData | null> => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/valet/locations");
      if (!res.ok) throw new Error("Failed to load locations");
      const json = (await res.json()) as LocationsData;
      setData(json);
      return json;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function scrollToForm() {
    setTimeout(() => {
      document.getElementById("loc-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }

  function handleCreated() {
    load();
  }

  async function handleUpdated() {
    const list = await load();
    if (list && selected) {
      const updated = list.properties.find((p) => p.id === selected.id);
      setSelected(updated || null);
    }
  }

  async function onRemove(loc: Property) {
    setDeleteTarget(loc);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/platform/valet/locations/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to remove location");
      }
      toast.success(`${deleteTarget.name} removed.`);
      setSelected(null);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const properties = data?.properties ?? [];
  const nextUid = data?.nextUid ?? "0";

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <div style={{ flex: 1.4, minWidth: 0 }}>
        <PageHeader
          icon={<MapPinIcon className="size-5" />}
          title="Locations"
          titleTrailing={
            <span style={{ fontSize: 14, color: "#6C7A93", fontWeight: 700, whiteSpace: "nowrap" }}>
              · {properties.length}
            </span>
          }
          description="Manage your valet properties, zones, slots, and NFC card pools."
          actions={
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                scrollToForm();
              }}
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
              Add location
            </button>
          }
        />
        {loading && (
          <div style={{ minHeight: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <LoadingIcon />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6C7A93" }}>Loading locations…</span>
          </div>
        )}
        {error && !loading && (
          <div style={{ minHeight: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ color: "#C0392B", fontSize: 13, fontWeight: 600 }}>{error}</span>
            <button className="btn-primary" onClick={() => load()}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
            {properties.map((l) => {
              const isSel = selected && selected.id === l.id;
              const overdue = l.overdue > 0;
              const statusText = overdue ? `${l.overdue} overdue` : "Live";
              const badgeBg = overdue ? "#FDF3E3" : "#E7F7EF";
              const badgeColor = overdue ? "#B97B17" : "#0C9D61";
              return (
                <div
                  key={l.id}
                  onClick={() => {
                    setSelected(l);
                    scrollToForm();
                  }}
                  style={{
                    padding: "18px 20px",
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    cursor: "pointer",
                    border: "1px solid #E7EAF0",
                    background: "#fff",
                    borderRadius: 20,
                    transition: "border-color .15s ease, background .15s ease",
                  }}
                >
                  {l.imageUrl ? (
                    <img src={l.imageUrl} alt={l.name} style={{ width: 52, height: 52, borderRadius: 15, objectFit: "cover", flex: "none" }} />
                  ) : (
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 15,
                        background: isSel ? "#FEEFE8" : "#F6F7F9",
                        color: isSel ? "#F4531F" : "#48566E",
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <BuildingIcon size={24} color={isSel ? "#F4531F" : "#48566E"} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1C2B46" }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: "#6C7A93", fontWeight: 600, marginTop: 2 }}>
                      {l.area} · {l.drivers} drivers · {l.zonesCount} zones · {l.slots} slots
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#1C2B46" }}>{l.occupied}</div>
                      <div style={{ fontSize: 10.5, color: "#6C7A93", fontWeight: 600 }}>cars today</div>
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "5px 12px",
                        borderRadius: 99,
                        fontSize: 10.5,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                        background: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      ● {statusText}
                    </span>
                    <ChevronRight />
                  </div>
                </div>
              );
            })}
            {properties.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6C7A93", padding: 40, fontSize: 13, fontWeight: 600 }}>
                No locations yet. Create one to start issuing valet cards.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {selected ? (
        <UpdateLocationForm location={selected} onUpdated={handleUpdated} onRemove={onRemove} />
      ) : (
        <CreateLocationForm nextUid={nextUid} onCreated={handleCreated} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Remove location?"
        message={
          deleteTarget
            ? `This will delete "${deleteTarget.name}" along with its zones, cards, offers and order history. This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        pending={deleting}
      />
    </div>
  );
}
