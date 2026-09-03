"use server";

import { getCurrentPlan, prismaWithoutTenantScoping } from "@saasclaude/db";

export async function resolveBreadcrumbTrail(pathname: string): Promise<string[]> {
  // ---- Organizations ----
  let m = pathname.match(/^\/super-admin\/organizations\/([^/]+)\/users\/new$/);
  if (m) {
    const org = await orgName(m[1]);
    return [org, "New user"];
  }
  m = pathname.match(/^\/super-admin\/organizations\/([^/]+)\/users\/([^/]+)\/edit$/);
  if (m) {
    const org = await orgName(m[1]);
    const user = await prismaWithoutTenantScoping.user.findUnique({
      where: { id: m[2] },
      select: { name: true, email: true },
    });
    return [org, user?.name ?? user?.email ?? m[2]];
  }
  m = pathname.match(/^\/super-admin\/organizations\/([^/]+)\/subscriptions\/([^/]+)$/);
  if (m) {
    const org = await orgName(m[1]);
    return [org, "Invoices / Logs"];
  }
  m = pathname.match(/^\/super-admin\/organizations\/([^/]+)$/);
  if (m) {
    return [await orgName(m[1])];
  }
  if (pathname === "/super-admin/organizations/new") return ["New customer"];

  // ---- Roles ----
  if (pathname === "/super-admin/roles/new") return ["Add role"];
  m = pathname.match(/^\/super-admin\/roles\/([^/]+)(?:\/edit)?$/);
  if (m) {
    const role = await prismaWithoutTenantScoping.role.findUnique({
      where: { id: m[1] },
      select: { name: true },
    });
    return [role?.name ?? m[1]];
  }

  // ---- Currencies ----
  if (pathname === "/super-admin/currencies/new") return ["Add currency"];
  m = pathname.match(/^\/super-admin\/currencies\/([^/]+)(?:\/edit)?$/);
  if (m) {
    const currency = await prismaWithoutTenantScoping.currency.findUnique({
      where: { id: m[1] },
      select: { name: true },
    });
    return [currency?.name ?? m[1]];
  }

  // ---- Plans ----
  if (pathname === "/super-admin/plans/new") return ["Create plan"];
  m = pathname.match(/^\/super-admin\/plans\/([^/]+)\/edit$/);
  if (m) {
    const plan = await getCurrentPlan(m[1]);
    return [plan?.name ?? m[1]];
  }

  return [];
}

async function orgName(id: string): Promise<string> {
  const org = await prismaWithoutTenantScoping.organization.findUnique({
    where: { id },
    select: { name: true },
  });
  return org?.name ?? id;
}
