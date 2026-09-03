"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BarChart3Icon,
  BellIcon,
  BoltIcon,
  Building2Icon,
  CreditCardIcon,
  InboxIcon,
  KeyIcon,
  LayoutDashboardIcon,
  LockIcon,
  LogOutIcon,
  NfcIcon,
  SettingsIcon,
  ShieldIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { logoutAction } from "@/lib/auth/logout-action";
import { OrgSwitcher, type OrgOption } from "./org-switcher";

const PRODUCT_NAV_ITEMS: Array<{ title: string; url: string; icon: React.ReactNode }> = [
  { title: "Dashboard", url: "/tenant-admin", icon: <LayoutDashboardIcon /> },
  { title: "Live Queue", url: "/tenant-admin/queue", icon: <BoltIcon /> },
  { title: "Locations", url: "/tenant-admin/locations", icon: <Building2Icon /> },
  { title: "Drivers", url: "/tenant-admin/drivers", icon: <UsersIcon /> },
  { title: "NFC Cards", url: "/tenant-admin/cards", icon: <NfcIcon /> },
  { title: "Offers", url: "/tenant-admin/offers", icon: <TagIcon /> },
  { title: "Reports", url: "/tenant-admin/reports", icon: <BarChart3Icon /> },
];

const SETTINGS_SUB_ITEMS: Array<{ title: string; url: string; icon: React.ReactNode }> = [
  { title: "Account", url: "/tenant-admin/settings/account", icon: <UserIcon className="opacity-80" /> },
  { title: "Security", url: "/tenant-admin/settings/security", icon: <LockIcon className="opacity-80" /> },
  { title: "Inbox", url: "/tenant-admin/settings/inbox", icon: <InboxIcon className="opacity-80" /> },
  { title: "Notifications", url: "/tenant-admin/settings/notifications", icon: <BellIcon className="opacity-80" /> },
  { title: "Active sessions", url: "/tenant-admin/settings/sessions", icon: <KeyIcon className="opacity-80" /> },
  { title: "API keys", url: "/tenant-admin/settings/api-keys", icon: <KeyIcon className="opacity-80" /> },
  { title: "Settings", url: "/tenant-admin/settings/general", icon: <SettingsIcon className="opacity-80" /> },
  { title: "Billing & Invoice", url: "/tenant-admin/settings/billing", icon: <CreditCardIcon className="opacity-80" /> },
  { title: "Team", url: "/tenant-admin/settings/team", icon: <UsersIcon className="opacity-80" /> },
  { title: "Roles", url: "/tenant-admin/settings/roles", icon: <ShieldIcon className="opacity-80" /> },
];

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || email[0]!.toUpperCase();
  }
  return email[0]!.toUpperCase();
}

export function TenantAdminSidebar({
  currentOrg,
  otherOrgs,
  user,
  canAccessSuperAdmin = false,
  isImpersonating = false,
  stopImpersonatingAction,
  ...props
}: {
  currentOrg: OrgOption;
  otherOrgs: OrgOption[];
  user: { name: string | null; email: string };
  /** When the user also holds a Super Admin (platform) role, show a back link to it. */
  canAccessSuperAdmin?: boolean;
  /** True while this session is impersonating an org admin; the back link must end it first. */
  isImpersonating?: boolean;
  /** Server action that ends impersonation and restores the real Super Admin session. */
  stopImpersonatingAction?: () => Promise<void>;
} & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() ?? "";
  const inSettings = pathname.startsWith("/tenant-admin/settings");

  const backToSuperAdmin =
    isImpersonating && stopImpersonatingAction ? (
      <form action={stopImpersonatingAction}>
        <SidebarMenuButton type="submit" tooltip="Back to Super Admin" className="w-full cursor-pointer">
          <ArrowLeftIcon className="opacity-80" />
          <span>Back to Super Admin</span>
        </SidebarMenuButton>
      </form>
    ) : (
      <SidebarMenuButton tooltip="Back to Super Admin" render={<Link href="/super-admin" />}>
        <ArrowLeftIcon className="opacity-80" />
        <span>Back to Super Admin</span>
      </SidebarMenuButton>
    );

  return (
    <Sidebar collapsible="icon" className="console-sa" {...props}>
      <SidebarHeader style={{ marginTop: -12, marginBottom: -12 }}>
        <OrgSwitcher current={currentOrg} others={otherOrgs} />
      </SidebarHeader>
      <SidebarContent>
        {canAccessSuperAdmin && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>{backToSuperAdmin}</SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
        {!inSettings && (
          <SidebarGroup>
            <SidebarGroupLabel>Product</SidebarGroupLabel>
            <SidebarMenu>
              {PRODUCT_NAV_ITEMS.map((item) => {
                const isActive =
                  (item.url === "/tenant-admin" && (pathname === "/tenant-admin" || pathname === "/tenant-admin/")) ||
                  (item.url !== "/tenant-admin" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton isActive={isActive} tooltip={item.title} render={<Link href={item.url} />}>
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {inSettings && (
          <SidebarGroup>
            <SidebarGroupLabel>Account &amp; Settings</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Back to dashboard" render={<Link href="/tenant-admin" />}>
                  <ArrowLeftIcon className="opacity-80" />
                  <span>Back to dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {SETTINGS_SUB_ITEMS.map((item) => {
                const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton isActive={isActive} tooltip={item.title} render={<Link href={item.url} />}>
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <ConsoleUser user={user} canAccessSuperAdmin={canAccessSuperAdmin} isImpersonating={isImpersonating} stopImpersonatingAction={stopImpersonatingAction} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ConsoleUser({
  user,
  canAccessSuperAdmin,
  isImpersonating = false,
  stopImpersonatingAction,
}: {
  user: { name: string | null; email: string };
  canAccessSuperAdmin: boolean;
  isImpersonating?: boolean;
  stopImpersonatingAction?: () => Promise<void>;
}) {
  const { isMobile } = useSidebar();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton className="console-sa-user hover:bg-white/5" />}>
        <div className="flex size-[34px] flex-none items-center justify-center rounded-full bg-linear-to-br from-(--brand-sunset) to-[#ff8a50] text-[12px] font-extrabold text-white">{initials(user.name, user.email)}</div>
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate text-[12.5px] font-extrabold text-white">{user.name ?? user.email}</span>
          <span className="truncate text-[10.5px] font-semibold text-sidebar-foreground/60">Organization member</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={8} className="w-[240px] rounded-[14px] border border-[#e7eaf0] p-1.5 shadow-[0_20px_50px_rgba(16,22,35,0.18)]">
        <div className="flex gap-2.5 items-center px-3 py-2.5 text-left">
          <div className="flex size-[34px] flex-none items-center justify-center rounded-full bg-linear-to-br from-(--brand-sunset) to-[#ff8a50] text-[12px] font-extrabold text-white">{initials(user.name, user.email)}</div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-extrabold text-[#1c2b46]">{user.name ?? user.email}</div>
            <div className="truncate text-[11.5px] font-semibold text-[#9aa6bc]">{user.email}</div>
          </div>
        </div>
        <div className="mx-0 h-px bg-[#e7eaf0] my-1" />
        {canAccessSuperAdmin ? (
          <>
            {isImpersonating && stopImpersonatingAction ? (
              <form action={stopImpersonatingAction}>
                <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />} className="rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#1c2b46] [&_svg]:size-4 [&_svg]:text-[#9aa6bc]">
                  <ArrowLeftIcon />
                  Back to Super Admin
                </DropdownMenuItem>
              </form>
            ) : (
              <DropdownMenuItem render={<Link href="/super-admin" />} className="rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#1c2b46] [&_svg]:size-4 [&_svg]:text-[#9aa6bc]">
                <ArrowLeftIcon />
                Back to Super Admin
              </DropdownMenuItem>
            )}
            <div className="mx-0 h-px bg-[#e7eaf0] my-1" />
          </>
        ) : null}
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