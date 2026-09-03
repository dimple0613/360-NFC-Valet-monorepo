"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2Icon, LogOutIcon, UserIcon } from "lucide-react";
import { BellIcon, BuildingIcon, CarIcon, ClipboardListIcon, CoinsIcon, CreditCardIcon, DatabaseBackupIcon, FileTextIcon, KeyRoundIcon, LayoutDashboardIcon, PackageIcon, PercentIcon, SettingsIcon, ShieldIcon } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NavLinks, type NavLinkItem } from "@/components/nav-links";
import { logoutAction } from "@/lib/auth/logout-action";

interface PlatformNavLinkItem extends NavLinkItem {
  requiresPermission: string;
}

const TOP_NAV_ITEMS: PlatformNavLinkItem[] = [
  {
    title: "Dashboard",
    url: "/super-admin",
    icon: <LayoutDashboardIcon />,
    requiresPermission: "core.platform.manage_organizations",
  },
];

interface PlatformNavGroupItem {
  title: string;
  items: PlatformNavLinkItem[];
}

const NAV_GROUPS: PlatformNavGroupItem[] = [
  {
    title: "Customer",
    items: [
      {
        title: "Customers",
        url: "/super-admin/organizations",
        icon: <BuildingIcon />,
        matchPrefix: true,
        requiresPermission: "core.platform.manage_organizations",
      },
      {
        title: "Roles",
        url: "/super-admin/roles",
        icon: <ShieldIcon />,
        matchPrefix: true,
        requiresPermission: "core.platform.manage_global_roles",
      },
      {
        title: "Subscriptions",
        url: "/super-admin/billing",
        icon: <CreditCardIcon />,
        matchPrefix: true,
        requiresPermission: "core.platform.view_billing",
      },
      {
        title: "Invoices",
        url: "/super-admin/invoices",
        icon: <FileTextIcon />,
        requiresPermission: "core.platform.view_billing",
      },
    ],
  },
  {
    title: "Plan",
    items: [
      {
        title: "Manage Plans",
        url: "/super-admin/plans",
        icon: <PackageIcon />,
        matchPrefix: true,
        requiresPermission: "core.platform.manage_plans",
      },
      {
        title: "Currencies",
        url: "/super-admin/currencies",
        icon: <CoinsIcon />,
        matchPrefix: true,
        requiresPermission: "core.platform.manage_plans",
      },
      {
        title: "Tax Settings",
        url: "/super-admin/tax-settings",
        icon: <PercentIcon />,
        requiresPermission: "core.platform.manage_plans",
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        // Lands on the General tab; the other tabs (incl. the key/value
        // "Platform Settings" page at /super-admin/settings) are reached from
        // the tab bar in settings/layout.tsx.
        title: "Settings",
        url: "/super-admin/settings/general",
        icon: <SettingsIcon />,
        requiresPermission: "core.platform.manage_settings",
      },
      {
        title: "Auth Providers",
        url: "/super-admin/settings/auth-providers",
        icon: <KeyRoundIcon />,
        requiresPermission: "core.platform.manage_auth_providers",
      },
      {
        title: "Payment Providers",
        url: "/super-admin/settings/payment-providers",
        icon: <CreditCardIcon />,
        requiresPermission: "core.platform.manage_payment_providers",
      },
      {
        title: "Notification Channels",
        url: "/super-admin/settings/notification-channels",
        icon: <BellIcon />,
        requiresPermission: "core.platform.manage_notification_channels",
      },
    ],
  },
  {
    title: "Report",
    items: [
      {
        title: "Log",
        url: "/super-admin/reports",
        icon: <ClipboardListIcon />,
        requiresPermission: "core.platform.view_audit_log",
      },
    ],
  },
];

const OTHER_NAV_ITEMS: PlatformNavLinkItem[] = [
  {
    title: "Platform Admins",
    url: "/super-admin/admins",
    icon: <ShieldIcon />,
    requiresPermission: "core.platform.manage_platform_admins",
  },
  {
    title: "Backup & Restore",
    url: "/super-admin/backup",
    icon: <DatabaseBackupIcon />,
    requiresPermission: "core.platform.manage_settings",
  },
];

// No org switcher here — the Super Admin portal isn't organization-scoped
// (a platform role, per FR-113, distinct from tenant roles), so the header
// is a static branding block instead of the tenant portal's OrgSwitcher.
export function SuperAdminSidebar({
  user,
  permissions,
  siteName,
  ...props
}: {
  user: { name: string | null; email: string };
  // FR-153: UI visibility derived from the same permission data the server
  // check used (requirePlatformIdentity) — not a separate, divergent UI-only
  // check. A section with no matching permission simply isn't shown; the
  // page itself still enforces the real check independently.
  permissions: string[];
  /** Platform name from Settings > General branding; falls back to "saasclaude". */
  siteName?: string;
} & React.ComponentProps<typeof Sidebar>) {
  const visibleTopItems = TOP_NAV_ITEMS.filter((item) => permissions.includes(item.requiresPermission));
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.requiresPermission)),
  })).filter((group) => group.items.length > 0);
  const visibleOtherItems = OTHER_NAV_ITEMS.filter((item) => permissions.includes(item.requiresPermission));

  return (
    <Sidebar collapsible="icon" className="console-sa" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="console-sa-brand cursor-default hover:bg-transparent">
              <div className="flex aspect-square size-[34px] items-center justify-center rounded-[11px] bg-linear-to-br from-(--brand-sunset) to-[#ff8a50] text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 8a7 7 0 0 1 0 8" />
                  <path d="M9.5 5.5a11 11 0 0 1 0 13" />
                  <path d="M13 3a15 15 0 0 1 0 18" />
                </svg>
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[14.5px] font-extrabold text-white">360 Valet</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavLinks label="Platform" items={visibleTopItems} />
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <FlatItem key={item.url} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        {visibleOtherItems.length > 0 ? <NavLinks label="More" items={visibleOtherItems} /> : null}
      </SidebarContent>
      <SidebarFooter>
        <ConsoleUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || email[0]!.toUpperCase();
  }
  return email[0]!.toUpperCase();
}

const initialsAvatar =
  "flex size-[34px] flex-none items-center justify-center rounded-full bg-linear-to-br from-(--brand-sunset) to-[#ff8a50] text-[12px] font-extrabold text-white";

function ConsoleUser({ user }: { user: { name: string | null; email: string } }) {
  const { isMobile } = useSidebar();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton className="console-sa-user hover:bg-white/5" />}>
        <div className="sidebar-avatar console-sa-avatar">{initials(user.name, user.email)}</div>
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate text-[12.5px] font-extrabold text-white">{user.name ?? user.email}</span>
          <span className="truncate text-[10.5px] font-semibold text-sidebar-foreground/60">Super Admin</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={8} className="w-[240px] rounded-[14px] border border-[#e7eaf0] p-1.5 shadow-[0_20px_50px_rgba(16,22,35,0.18)]">
        <div className="flex gap-2.5 items-center px-3 py-2.5 text-left">
          <div className={initialsAvatar}>{initials(user.name, user.email)}</div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-extrabold text-[#1c2b46]">{user.name ?? user.email}</div>
            <div className="truncate text-[11.5px] font-semibold text-[#9aa6bc]">{user.email}</div>
          </div>
        </div>
        <div className="mx-0 h-px bg-[#e7eaf0] my-1" />
        <DropdownMenuItem render={<Link href="/tenant-admin/settings/account" />} className="rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#1c2b46] [&_svg]:size-4 [&_svg]:text-[#9aa6bc]">
          <UserIcon />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/tenant-admin/settings/general" />} className="rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#1c2b46] [&_svg]:size-4 [&_svg]:text-[#9aa6bc]">
          <Building2Icon />
          Organization
        </DropdownMenuItem>
        <div className="mx-0 h-px bg-[#e7eaf0] my-1" />
        <form action={logoutAction}>
          <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />} className="rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#E23D3D] hover:bg-[#FDEBEB] [&_svg]:size-4 [&_svg]:text-[#E23D3D]">
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FlatItem({ title, url, icon, matchPrefix }: PlatformNavLinkItem) {
  const pathname = usePathname() ?? "";
  const isActive = matchPrefix
    ? pathname === url || pathname.startsWith(`${url}/`)
    : pathname === url;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} tooltip={title} render={<Link href={url} />}>
        {icon}
        <span>{title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
