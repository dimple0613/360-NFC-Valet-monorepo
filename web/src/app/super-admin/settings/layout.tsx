import { SettingsIcon } from "lucide-react";
import { requirePlatformIdentity } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs, type SettingsTab } from "./settings-tabs";

// The tabbed shell for the Super Admin settings area. "General" is the new
// consolidated page; the other tabs are the pre-existing adapter-registry
// pages, folded in as tabs rather than being reached only from the sidebar.
// Each tab is shown only if the viewer holds the permission its own page
// enforces server-side (FR-153) — a viewer without, say,
// manage_payment_providers just doesn't see that tab.
const TABS: (SettingsTab & { requiresPermission: string })[] = [
  { label: "General", href: "/super-admin/settings/general", requiresPermission: "core.platform.manage_settings" },
  {
    label: "Platform Settings",
    href: "/super-admin/settings",
    exact: true,
    requiresPermission: "core.platform.manage_settings",
  },
  {
    label: "Auth Providers",
    href: "/super-admin/settings/auth-providers",
    requiresPermission: "core.platform.manage_auth_providers",
  },
  {
    label: "Payment Providers",
    href: "/super-admin/settings/payment-providers",
    requiresPermission: "core.platform.manage_payment_providers",
  },
  {
    label: "Notification Channels",
    href: "/super-admin/settings/notification-channels",
    requiresPermission: "core.platform.manage_notification_channels",
  },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { permissions } = await requirePlatformIdentity();
  const visibleTabs: SettingsTab[] = TABS.filter((tab) => permissions.includes(tab.requiresPermission)).map(
    (tab) => ({ label: tab.label, href: tab.href, exact: tab.exact }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<SettingsIcon className="size-5" />}
        title="Settings"
        description="Platform-wide configuration: general defaults, auth, payment, and notification providers."
      />
      {visibleTabs.length > 0 ? <SettingsTabs tabs={visibleTabs} /> : null}
      <div>{children}</div>
    </div>
  );
}
