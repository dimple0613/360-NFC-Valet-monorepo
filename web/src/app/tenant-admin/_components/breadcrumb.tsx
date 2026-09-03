"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LABEL_BY_PREFIX: Array<{ prefix: string; label: string }> = [
  { prefix: "/tenant-admin/queue", label: "Live Queue" },
  { prefix: "/tenant-admin/locations", label: "Locations" },
  { prefix: "/tenant-admin/drivers", label: "Drivers" },
  { prefix: "/tenant-admin/cards", label: "NFC Cards" },
  { prefix: "/tenant-admin/offers", label: "Offers" },
  { prefix: "/tenant-admin/reports", label: "Reports" },
  { prefix: "/tenant-admin/settings/account", label: "Account" },
  { prefix: "/tenant-admin/settings/security", label: "Security" },
  { prefix: "/tenant-admin/settings/inbox", label: "Inbox" },
  { prefix: "/tenant-admin/settings/notifications", label: "Notifications" },
  { prefix: "/tenant-admin/settings/sessions", label: "Active sessions" },
  { prefix: "/tenant-admin/settings/api-keys", label: "API keys" },
  { prefix: "/tenant-admin/settings/general", label: "Settings" },
  { prefix: "/tenant-admin/settings/billing", label: "Billing & Invoice" },
  { prefix: "/tenant-admin/settings/team", label: "Team" },
  { prefix: "/tenant-admin/settings/roles", label: "Roles" },
  { prefix: "/tenant-admin/settings", label: "Settings" },
];

function currentPageLabel(pathname: string): string {
  const match = LABEL_BY_PREFIX.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (match) return match.label;
  if (pathname === "/tenant-admin" || pathname === "/tenant-admin/") return "Dashboard";
  return "Tenant Admin";
}

export function TenantAdminBreadcrumb({ organizationName }: { organizationName: string }) {
  const pathname = usePathname() ?? "";
  const label = currentPageLabel(pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap whitespace-nowrap">
        <BreadcrumbItem className="hidden md:inline-flex">
          <BreadcrumbPage className="text-[13px] font-semibold text-muted-foreground">
            {organizationName}
          </BreadcrumbPage>
        </BreadcrumbItem>
        {pathname !== "/tenant-admin" && pathname !== "/tenant-admin/" ? (
          <>
            <BreadcrumbSeparator className="hidden md:inline-flex" />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-[13px] font-bold text-foreground">{label}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}