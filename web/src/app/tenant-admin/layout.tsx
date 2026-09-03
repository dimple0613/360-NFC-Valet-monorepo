import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { endImpersonation, getUserPlatformPermissions, prismaWithoutTenantScoping } from "@saasclaude/db";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireIdentity } from "@/lib/auth/current-user";
import { clearSessionCookie, restoreSessionAfterImpersonation } from "@/lib/auth/session";
import { clearWsTokenCookie } from "@/lib/auth/ws-token";
import { TenantAdminBreadcrumb } from "./_components/breadcrumb";
import { TenantAdminSidebar } from "./_components/sidebar";

export default async function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) forbidden();

  const memberships = await prismaWithoutTenantScoping.organizationMembership.findMany({
    where: { userId: identity.user.id, status: "ACTIVE" },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  const currentMembership = memberships.find((m) => m.organizationId === organizationId);
  if (!currentMembership) forbidden();
  const currentOrg = {
    id: currentMembership.organization.id,
    name: currentMembership.organization.name,
    status: currentMembership.organization.status,
  };
  const otherOrgs = memberships
    .filter((m) => m.organizationId !== organizationId)
    .map((m) => ({ id: m.organization.id, name: m.organization.name, status: m.organization.status }));

  const platformUserId = identity.session.impersonatorUserId ?? identity.user.id;
  const platformPermissions = await getUserPlatformPermissions(platformUserId);
  const canAccessSuperAdmin = platformPermissions.length > 0;

  async function stopImpersonatingAction() {
    "use server";
    const current = await requireIdentity();
    const orgId = current.session.organizationId;
    if (current.session.impersonatorUserId) {
      await endImpersonation(current.session.sessionId);
    }
    if (await restoreSessionAfterImpersonation()) {
      // Purging both portals' layout caches ensures no stale server-render
      // keyed to the now-revoked impersonation session is served to the next
      // navigation. Without this, the client router can re-render the
      // previously-mounted tenant-admin route using the revoked impersonation
      // token (or a half-resolved restored session), which the layout's
      // requireIdentity / membership check rejects as a transient 403/401
      // until a manual refresh re-resolves with the restored cookie.
      revalidatePath("/tenant-admin", "layout");
      revalidatePath("/super-admin", "layout");
      // The WS token cookie still points at the just-revoked impersonation
      // session — clear it so no browser socket can present a dead credential.
      await clearWsTokenCookie();
      redirect(orgId ? `/super-admin/organizations/${orgId}` : "/super-admin/organizations");
    }
    await clearSessionCookie();
    redirect("/login");
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "290px" } as React.CSSProperties}>
      <TenantAdminSidebar
        currentOrg={currentOrg}
        otherOrgs={otherOrgs}
        user={identity.user}
        canAccessSuperAdmin={canAccessSuperAdmin}
        isImpersonating={Boolean(identity.session.impersonatorUserId)}
        stopImpersonatingAction={stopImpersonatingAction}
      />
      <SidebarInset>
        {identity.session.impersonatorUserId ? (
          <div className="flex items-center justify-between gap-4 border-b border-white/8 bg-[#16213a] px-[30px] py-2.5 text-[12.5px] font-semibold text-[#c5cede]">
            <span>
              You are impersonating <span className="font-extrabold text-white">{identity.user.email}</span>. This session
              ends automatically in 30 minutes.
            </span>
            <form action={stopImpersonatingAction}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-[99px] bg-[#f4531f] px-4 py-1.5 text-[12px] font-extrabold tracking-[1.2px] text-white transition-colors hover:bg-[#d6430f] cursor-pointer"
              >
                Stop impersonating
              </button>
            </form>
          </div>
        ) : null}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <TenantAdminBreadcrumb organizationName={currentOrg.name} />
          </div>
        </header>
        <main className="super-console flex flex-1 flex-col gap-4 px-[30px] py-[26px]">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
