"use client";

import { Fragment, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { resolveBreadcrumbTrail } from "./breadcrumb-actions";

const LABEL_BY_PREFIX: Array<{ prefix: string; label: string }> = [
  { prefix: "/super-admin/organizations", label: "Customers" },
  { prefix: "/super-admin/roles", label: "Roles" },
  { prefix: "/super-admin/billing", label: "Subscriptions" },
  { prefix: "/super-admin/invoices", label: "Invoices" },
  { prefix: "/super-admin/plans", label: "Manage Plans" },
  { prefix: "/super-admin/currencies", label: "Currencies" },
  { prefix: "/super-admin/tax-settings", label: "Tax Settings" },
  { prefix: "/super-admin/settings/general", label: "Settings" },
  { prefix: "/super-admin/settings/auth-providers", label: "Auth Providers" },
  { prefix: "/super-admin/settings/payment-providers", label: "Payment Providers" },
  { prefix: "/super-admin/settings/notification-channels", label: "Notification Channels" },
  { prefix: "/super-admin/settings", label: "Settings" },
  { prefix: "/super-admin/reports", label: "Log" },
  { prefix: "/super-admin/admins", label: "Platform Admins" },
];

function currentPageLabel(pathname: string): string {
  const match = LABEL_BY_PREFIX.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (match) return match.label;
  if (pathname === "/super-admin" || pathname === "/super-admin/") return "Dashboard";
  return "Super Admin";
}

export function SuperAdminBreadcrumb() {
  const pathname = usePathname() ?? "";
  const label = currentPageLabel(pathname);
  const [trail, setTrail] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    resolveBreadcrumbTrail(pathname).then((leafs) => {
      if (!cancelled) setTrail(leafs);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap whitespace-nowrap">
        <BreadcrumbItem className="hidden md:inline-flex">
          <BreadcrumbPage className="text-[13px] font-semibold text-muted-foreground">
            Super Admin
          </BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:inline-flex" />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-[13px] font-bold text-foreground">{label}</BreadcrumbPage>
        </BreadcrumbItem>
        {trail.map((segment) => (
          <Fragment key={segment}>
            <BreadcrumbSeparator className="hidden md:inline-flex" />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-[13px] font-bold text-foreground">{segment}</BreadcrumbPage>
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
