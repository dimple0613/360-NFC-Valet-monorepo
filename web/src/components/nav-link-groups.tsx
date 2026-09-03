"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { NavLinkItem } from "@/components/nav-links";

export interface NavGroupItem {
  title: string;
  icon: React.ReactNode;
  items: NavLinkItem[];
}

function isItemActive(item: NavLinkItem, pathname: string): boolean {
  return item.matchPrefix ? pathname === item.url || pathname.startsWith(`${item.url}/`) : pathname === item.url;
}

/** Same collapsible-group nav pattern shadcn's sidebar samples use — a top-level trigger that expands into a SidebarMenuSub of real links, auto-expanded when the current route is inside it. */
export function NavLinkGroups({ label, groups }: { label: string; groups: NavGroupItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {groups.map((group) => (
          <NavLinkGroup key={group.title} group={group} pathname={pathname} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/** Own component (not inlined in the .map) so its open state can be a real hook — auto-expands when the route enters the group, without fighting a manual toggle via a `defaultOpen` that silently changes after mount. */
function NavLinkGroup({ group, pathname }: { group: NavGroupItem; pathname: string }) {
  const groupActive = group.items.some((item) => isItemActive(item, pathname));
  const [open, setOpen] = useState(groupActive);

  // Adjust state during render (React's documented alternative to an effect
  // for this exact case) instead of setState-in-useEffect, which the
  // react-hooks/set-state-in-effect rule now flags as a cascading-render risk.
  const [prevGroupActive, setPrevGroupActive] = useState(groupActive);
  if (groupActive !== prevGroupActive) {
    setPrevGroupActive(groupActive);
    if (groupActive) setOpen(true);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton tooltip={group.title} className="group/collapsible-trigger" />}>
          {group.icon}
          <span>{group.title}</span>
          <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[panel-open]/collapsible-trigger:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton isActive={isItemActive(item, pathname)} render={<Link href={item.url} />}>
                  <span>{item.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
