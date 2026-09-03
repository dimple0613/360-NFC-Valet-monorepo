"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export interface NavLinkItem {
  title: string;
  url: string;
  icon: React.ReactNode;
  /** Also highlight for nested routes under `url` (e.g. an org list item active while viewing an org detail page). */
  matchPrefix?: boolean;
}

export function NavLinks({ label, items }: { label: string; items: NavLinkItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = item.matchPrefix
            ? pathname === item.url || pathname.startsWith(`${item.url}/`)
            : pathname === item.url;
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
  );
}
