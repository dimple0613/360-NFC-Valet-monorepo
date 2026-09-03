import type { Metadata } from "next";
import { getBrandingSettings } from "@saasclaude/db";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requirePlatformIdentity } from "@/lib/auth/current-user";
import { SuperAdminBreadcrumb } from "./_components/breadcrumb";
import { SuperAdminSidebar } from "./_components/sidebar";

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getBrandingSettings();
  return { title: siteName ? `Super Admin · ${siteName}` : "Super Admin" };
}

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [identity, branding] = await Promise.all([requirePlatformIdentity(), getBrandingSettings()]);

  return (
    <SidebarProvider style={{ "--sidebar-width": "290px" } as React.CSSProperties}>
      <SuperAdminSidebar
        user={identity.user}
        permissions={identity.permissions}
        siteName={branding.siteName ?? undefined}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <SuperAdminBreadcrumb />
          </div>
        </header>
        <main className="super-console flex flex-1 flex-col gap-4 px-[30px] py-[26px]">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
