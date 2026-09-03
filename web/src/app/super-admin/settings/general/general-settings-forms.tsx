"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormTextareaField, FormCheckboxField, FormSelectField } from "@/components/console-form-field";
import { saveBrandingAction, saveAccessAction, saveBillingAction, saveSecurityAction } from "./actions";

const CAPTCHA_OPTIONS = [
  { value: "none", label: "None" },
  { value: "recaptcha_v2", label: "Google reCAPTCHA v2" },
  { value: "recaptcha_v3", label: "Google reCAPTCHA v3" },
  { value: "hcaptcha", label: "hCaptcha" },
];

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

const optionalUrl = yup
  .string()
  .transform((value) => (value && String(value).trim() ? value : undefined))
  .test("is-url", "Must be a valid URL.", (value) => {
    if (!value) return true;
    try {
      new URL(String(value));
      return true;
    } catch {
      return false;
    }
  });

const brandingSchema = yup.object({
  siteName: yup.string().nullable(),
  siteDescription: yup.string().nullable(),
  logoLightUrl: optionalUrl,
  logoDarkUrl: optionalUrl,
  faviconUrl: optionalUrl,
});

const billingSchema = yup.object({
  invoiceNumberFormat: yup.string().required("Invoice number format is required."),
});

const securitySchema = yup.object({
  captchaProvider: yup.string().required(),
  captchaSiteKey: yup.string().nullable(),
  captchaSecretKey: yup.string().nullable(),
});

export function GeneralSettingsForms({
  branding,
  access,
  invoiceNumberFormat,
  security,
}: {
  branding: BrandingDefaults;
  access: AccessDefaults;
  invoiceNumberFormat: string;
  security: SecurityDefaults;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Branding */}
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <div className="mb-1 text-[15px] font-extrabold">Branding</div>
        <p className="mb-4 text-xs text-muted-foreground">
          Platform name and imagery. Logos and the favicon are hosted-image URLs — paste a link to an image you
          host elsewhere (there is no file upload yet).
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
                <FormField name="logoLightUrl" label="Logo URL (light bg)" placeholder="https://…/logo-light.svg" />
                <FormField name="logoDarkUrl" label="Logo URL (dark bg)" placeholder="https://…/logo-dark.svg" />
                <FormField name="faviconUrl" label="Favicon URL" placeholder="https://…/favicon.ico" />
              </div>
              <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save branding"}
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
                <span className="font-medium text-foreground">Stored, not yet enforced.</span> Maintenance mode needs a middleware gate to actually take the app offline — that is not wired yet.
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
                <span className="font-medium text-foreground">Stored, not yet enforced.</span> 2FA enforcement at sign-in and a CAPTCHA widget on the auth forms are not wired yet — these values are persisted for when they are.
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
