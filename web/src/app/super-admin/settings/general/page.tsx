import { getAccessSettings, getBrandingSettings, getInvoiceNumberFormat, getSecurityDefaultSettings } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { GeneralSettingsForms } from "./general-settings-forms";

export default async function GeneralSettingsPage() {
  await requirePlatformAccess("core.platform.manage_settings");

  const [branding, access, invoiceNumberFormat, security] = await Promise.all([
    getBrandingSettings(),
    getAccessSettings(),
    getInvoiceNumberFormat(),
    getSecurityDefaultSettings(),
  ]);

  return (
    <GeneralSettingsForms
      branding={branding}
      access={access}
      invoiceNumberFormat={invoiceNumberFormat}
      security={security}
    />
  );
}
