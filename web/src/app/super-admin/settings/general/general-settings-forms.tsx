"use client";

import { useId, useState, type ChangeEvent } from "react";
import { Formik, Form, useFormikContext } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { EyeIcon, UploadIcon } from "lucide-react";
import { FormField, FormTextareaField, FormCheckboxField, FormSelectField } from "@/components/console-form-field";
import { saveBrandingAction, saveAccessAction, saveBillingAction, saveSecurityAction, saveContentAction } from "./actions";

const CAPTCHA_OPTIONS = [
  { value: "none", label: "None" },
  { value: "recaptcha_v2", label: "Google reCAPTCHA v2" },
  { value: "recaptcha_v3", label: "Google reCAPTCHA v3" },
  { value: "hcaptcha", label: "hCaptcha" },
];

// Mirrors MAX_BRAND_IMAGE_DATA_URL_LENGTH in @saasclaude/db (700_000 chars of
// base64 ≈ 525 KB binary). Kept local so this client component never imports
// the db package — that module is server-only.
const MAX_IMAGE_DATA_URL_LENGTH = 700_000;
const MAX_IMAGE_FILE_BYTES = 500_000;
const ALLOWED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

interface BrandingDefaults {
  siteName: string | null;
  siteDescription: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
}

interface AccessDefaults {
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}

interface SecurityDefaults {
  require2fa: boolean;
  captchaProvider: string;
  captchaSiteKey: string | null;
  captchaSecretConfigured: boolean;
}

interface ContentDefaults {
  brandName: string;
  copyright: string;
  supportEmail: string | null;
  loginTitle: string;
  loginSubtitle: string;
  loginHeroHeadline: string;
  loginHeroSub: string;
  signupTitle: string;
  signupSubtitle: string;
  signupHeroHeadline: string;
  signupHeroSub: string;
  forgotTitle: string;
  forgotSubtitle: string;
  forgotHeroHeadline: string;
  forgotHeroSub: string;
  error404Title: string;
  error404Body: string;
  error403Title: string;
  error403Body: string;
  error401Title: string;
  error401Body: string;
  error500Title: string;
  error500Body: string;
}

const optionalImage = yup
  .string()
  .transform((value) => (value && String(value).trim() ? value : undefined))
  .test("is-value-url-or-image", "Enter an image URL or upload an image file.", (value) => {
    if (!value) return true;
    const raw = String(value);
    if (raw.startsWith("data:image/")) {
      return raw.length <= MAX_IMAGE_DATA_URL_LENGTH;
    }
    try {
      const url = new URL(raw);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });

const brandingSchema = yup.object({
  siteName: yup.string().nullable(),
  siteDescription: yup.string().nullable(),
  logoLightUrl: optionalImage,
  logoDarkUrl: optionalImage,
  faviconUrl: optionalImage,
});

const billingSchema = yup.object({
  invoiceNumberFormat: yup.string().required("Invoice number format is required."),
});

const securitySchema = yup.object({
  captchaProvider: yup.string().required(),
  captchaSiteKey: yup.string().nullable(),
  captchaSecretKey: yup.string().nullable(),
});

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

// File-picker + hosted-URL image input for the branding logos/favicon, styled to
// match the location/offer uploaders elsewhere in the console (read-only field row
// with an eye toggle, dashed preview box, Remove pill). Picked files are read to an
// inline data URL and saved straight into the platform settings row — nothing hits
// the filesystem, so the stored image can never 404 in production (the classic
// "works in dev, URL breaks deployment" issue).
function ImageUploadField({
  name,
  label,
  hint,
}: {
  name: string;
  label: string;
  hint?: string;
}) {
  const formik = useFormikContext();
  const fileId = useId();
  const value = (formik.values as Record<string, string>)[name] ?? "";
  const meta = formik.getFieldMeta(name);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
      formik.setFieldError(name, `Unsupported image type "${file.type}". Use PNG, JPEG, WebP, GIF, SVG or ICO.`);
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      formik.setFieldError(name, "Image is too large. Use an image under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        formik.setFieldError(name, "Image is too large. Use an image under 500 KB.");
        return;
      }
      formik.setFieldValue(name, dataUrl);
      formik.setFieldError(name, undefined);
      setUrlMode(false);
      setPreviewOpen(true);
    };
    reader.onerror = () => formik.setFieldError(name, "Couldn't read that file. Try another image.");
    reader.readAsDataURL(file);
  };

  const toggleUrl = () => {
    const next = !urlMode;
    setUrlMode(next);
    if (next) {
      setUrlDraft(value.startsWith("data:") ? "" : value);
      setPreviewOpen(false);
    }
  };

  const clear = () => {
    formik.setFieldValue(name, "");
    formik.setFieldError(name, undefined);
    setUrlDraft("");
    setUrlMode(false);
    setPreviewOpen(false);
  };

  return (
    <div>
      <div className="field">
        <label className="field-label">{label}</label>
        <label
          htmlFor={value ? undefined : fileId}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, cursor: value ? "default" : "pointer" }}
        >
          <input
            className="field-value input"
            readOnly
            placeholder="Upload image (PNG/JPEG/SVG/ICO)"
            value={value ? (value.startsWith("data:") ? "Image attached" : value) : urlDraft}
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
              aria-label={`${label} preview`}
              style={{
                width: "100%",
                height: 180,
                borderRadius: 10,
                background: "#FAFBFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {
                // Inline data URLs (uploads) can't use next/image's optimizer — render as-is.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt={label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              }
            </div>
          </div>
          <button
            type="button"
            onClick={clear}
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
      {hint ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: 500,
            color: "#6c7a93",
            lineHeight: "16px",
          }}
        >
          {hint}
        </div>
      ) : null}
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
      <input
        id={fileId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
        onChange={onFile}
        tabIndex={-1}
        aria-hidden="true"
        style={HIDDEN_FILE}
      />
      <div style={{ marginTop: 8 }}>
        {urlMode ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="field-value input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="https://…/logo.svg"
              value={urlDraft}
              onChange={(e) => {
                setUrlDraft(e.target.value);
                formik.setFieldValue(name, e.target.value);
              }}
              onBlur={() => formik.setFieldTouched(name, true)}
            />
            <button
              type="button"
              onClick={toggleUrl}
              className="btn-primary"
              style={{ fontSize: 12, padding: "8px 14px" }}
            >
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleUrl}
            className="text-xs underline"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#6c7a93" }}
          >
            or paste a hosted image URL instead…
          </button>
        )}
      </div>
    </div>
  );
}

export function GeneralSettingsForms({
  branding,
  access,
  invoiceNumberFormat,
  security,
  content,
}: {
  branding: BrandingDefaults;
  access: AccessDefaults;
  invoiceNumberFormat: string;
  security: SecurityDefaults;
  content: ContentDefaults;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Branding */}
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <div className="mb-1 text-[15px] font-extrabold">Branding</div>
        <p className="mb-4 text-xs text-muted-foreground">
          Platform name and imagery. Logos and the favicon are stored directly in the settings — upload a file and
          it is served from the database, so it never 404s in production. Or paste a hosted image URL instead.
        </p>
        <Formik
          initialValues={{
            siteName: branding.siteName ?? "",
            siteDescription: branding.siteDescription ?? "",
            logoLightUrl: branding.logoLightUrl ?? "",
            logoDarkUrl: branding.logoDarkUrl ?? "",
            faviconUrl: branding.faviconUrl ?? "",
          }}
          validationSchema={brandingSchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const fd = new FormData();
              Object.entries(values).forEach(([k, v]) => fd.append(k, v ?? ""));
              await saveBrandingAction(fd);
              toast.success("Branding saved.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="siteName" label="Site name" placeholder="saasclaude" />
                <FormField name="siteDescription" label="Site description" placeholder="A short tagline" />
                <ImageUploadField name="logoLightUrl" label="Logo (light background)" hint="Shown on the dark sign-in panel and error pages." />
                <ImageUploadField name="logoDarkUrl" label="Logo (dark background)" hint="For light surfaces — most portals today use the light-bg logo." />
                <ImageUploadField name="faviconUrl" label="Favicon" hint="Browser tab icon. ICO or PNG recommended." />
              </div>
              <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save branding"}
              </button>
            </Form>
          )}
        </Formik>
      </div>

      {/* Pages & content */}
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <div className="mb-1 text-[15px] font-extrabold">Pages &amp; content</div>
        <p className="mb-4 text-xs text-muted-foreground">
          Copy for the sign-in pages and error pages visitors see. Empty fields fall back to the platform defaults —
          you only need to fill in what you want to change.
        </p>
        <Formik
          initialValues={{
            brandName: content.brandName,
            copyright: content.copyright,
            supportEmail: content.supportEmail ?? "",
            loginTitle: content.loginTitle,
            loginSubtitle: content.loginSubtitle,
            loginHeroHeadline: content.loginHeroHeadline,
            loginHeroSub: content.loginHeroSub,
            signupTitle: content.signupTitle,
            signupSubtitle: content.signupSubtitle,
            signupHeroHeadline: content.signupHeroHeadline,
            signupHeroSub: content.signupHeroSub,
            forgotTitle: content.forgotTitle,
            forgotSubtitle: content.forgotSubtitle,
            forgotHeroHeadline: content.forgotHeroHeadline,
            forgotHeroSub: content.forgotHeroSub,
            error404Title: content.error404Title,
            error404Body: content.error404Body,
            error403Title: content.error403Title,
            error403Body: content.error403Body,
            error401Title: content.error401Title,
            error401Body: content.error401Body,
            error500Title: content.error500Title,
            error500Body: content.error500Body,
          }}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const fd = new FormData();
              Object.entries(values).forEach(([k, v]) => fd.append(k, v ?? ""));
              await saveContentAction(fd);
              toast.success("Page content saved.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <SectionLabel>Brand details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="brandName" label="Brand name" placeholder="Overrides the Site name on auth/error pages" />
                <FormField name="supportEmail" label="Support email" placeholder="support@360valet.com" />
                <FormField name="copyright" label="Footer copyright" placeholder="© 2026 We Want 360 · Dubai, UAE" />
              </div>

              <SectionLabel>Sign in page</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="loginTitle" label="Form heading" placeholder="Welcome back" />
                <FormField name="loginSubtitle" label="Form subtitle" placeholder="Sign in to your saasclaude account" />
                <FormField name="loginHeroHeadline" label="Panel headline" placeholder="Every car back at the curb before the guest is." />
                <FormField name="loginHeroSub" label="Panel subtitle" placeholder="Run every property, driver and NFC card from one console…" />
              </div>

              <SectionLabel>Sign up page</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="signupTitle" label="Form heading" placeholder="Create your organization" />
                <FormField name="signupSubtitle" label="Form subtitle" placeholder="Set up your organization in a minute" />
                <FormField name="signupHeroHeadline" label="Panel headline" placeholder="Every car back at the curb before the guest is." />
                <FormField name="signupHeroSub" label="Panel subtitle" placeholder="Set up your organization in a minute." />
              </div>

              <SectionLabel>Password reset page</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="forgotTitle" label="Form heading" placeholder="Reset your password" />
                <FormField name="forgotSubtitle" label="Form subtitle" placeholder="We'll email you a link to reset it" />
                <FormField name="forgotHeroHeadline" label="Panel headline" placeholder="Every car back at the curb before the guest is." />
                <FormField name="forgotHeroSub" label="Panel subtitle" placeholder="Reset your password to get back into the operations console." />
              </div>

              <SectionLabel>Error pages</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="error404Title" label="404 heading" placeholder="Page not found" />
                <FormField name="error404Body" label="404 message" placeholder="The page you're looking for doesn't exist or has been moved." />
                <FormField name="error403Title" label="403 heading" placeholder="Access denied" />
                <FormField name="error403Body" label="403 message" placeholder="Your account doesn't have permission to view this page." />
                <FormField name="error401Title" label="401 heading" placeholder="Sign in required" />
                <FormField name="error401Body" label="401 message" placeholder="You need to sign in to view this page." />
                <FormField name="error500Title" label="500 heading" placeholder="Something went wrong" />
                <FormField name="error500Body" label="500 message" placeholder="An unexpected error occurred while loading this page." />
              </div>

              <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save page content"}
              </button>
            </Form>
          )}
        </Formik>
      </div>

      {/* Registration & access */}
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <div className="mb-1 text-[15px] font-extrabold">Registration &amp; access</div>
        <p className="mb-4 text-xs text-muted-foreground">Who can create an account, and whether the platform is open right now.</p>
        <Formik
          initialValues={{
            registrationEnabled: access.registrationEnabled,
            maintenanceMode: access.maintenanceMode,
            maintenanceMessage: access.maintenanceMessage ?? "",
          }}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const fd = new FormData();
              if (values.registrationEnabled) fd.append("registrationEnabled", "on");
              if (values.maintenanceMode) fd.append("maintenanceMode", "on");
              fd.append("maintenanceMessage", values.maintenanceMessage ?? "");
              await saveAccessAction(fd);
              toast.success("Access settings saved.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormCheckboxField name="registrationEnabled" label="Allow public sign-up" description="When off, the self-serve sign-up flow is rejected. Super Admins can still onboard customers manually." />
              <FormCheckboxField name="maintenanceMode" label="Maintenance mode" description="Show an offline message instead of the application." />
              <FormTextareaField name="maintenanceMessage" label="Maintenance message" placeholder="We'll be back shortly." rows={2} />
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Enforced.</span> When on, web/proxy.ts serves the /maintenance page for all browser page navigations (APIs and the Super Admin console stay reachable).
              </p>
              <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save access settings"}
              </button>
            </Form>
          )}
        </Formik>
      </div>

      {/* Billing */}
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <div className="mb-1 text-[15px] font-extrabold">Billing</div>
        <p className="mb-4 text-xs text-muted-foreground">How issued invoice numbers are formatted.</p>
        <Formik
          initialValues={{ invoiceNumberFormat }}
          validationSchema={billingSchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const fd = new FormData();
              fd.append("invoiceNumberFormat", values.invoiceNumberFormat);
              await saveBillingAction(fd);
              toast.success("Invoice format saved.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormField name="invoiceNumberFormat" label="Invoice number format" placeholder="INV-{NUMBER}" />
              <p className="text-xs text-muted-foreground">
                <code>{"{NUMBER}"}</code> is replaced with a zero-padded per-customer sequence (e.g. <code>000001</code>).
              </p>
              <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save invoice format"}
              </button>
            </Form>
          )}
        </Formik>
      </div>

      {/* Security defaults */}
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <div className="mb-1 text-[15px] font-extrabold">Security defaults</div>
        <p className="mb-4 text-xs text-muted-foreground">Platform-wide defaults for two-factor authentication and CAPTCHA.</p>
        <Formik
          initialValues={{
            require2fa: security.require2fa,
            captchaProvider: security.captchaProvider,
            captchaSiteKey: security.captchaSiteKey ?? "",
            captchaSecretKey: "",
          }}
          validationSchema={securitySchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const fd = new FormData();
              if (values.require2fa) fd.append("require2fa", "on");
              fd.append("captchaProvider", values.captchaProvider);
              fd.append("captchaSiteKey", values.captchaSiteKey ?? "");
              fd.append("captchaSecretKey", values.captchaSecretKey ?? "");
              await saveSecurityAction(fd);
              toast.success("Security settings saved.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormCheckboxField name="require2fa" label="Require two-factor authentication" description="Every user must enrol a second factor to sign in." />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField name="captchaProvider" label="CAPTCHA provider" options={CAPTCHA_OPTIONS} />
                <FormField name="captchaSiteKey" label="CAPTCHA site key" />
                <FormField name="captchaSecretKey" label="CAPTCHA secret key" type="password" placeholder={security.captchaSecretConfigured ? "•••••••• — leave blank to keep current" : "Not set"} />
              </div>
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Enforced.</span> With this on, a user without a second factor must enrol it (at /login/mfa/enroll) before any session is created — enforced for both local login and OAuth sign-in. When a CAPTCHA provider and keys are configured below, the widget appears on the login, sign-up, password-reset and reset-link forms and its token is verified server-side before the request proceeds.
              </p>
              <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save security settings"}
              </button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 border-b pb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </div>
  );
}
