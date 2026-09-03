"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Building2Icon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { switchOrganizationAction } from "./switch-org-action";

export interface OrgOption {
  id: string;
  name: string;
  status: string;
}

/** Adapted from shadcn's TeamSwitcher (sidebar-07): plain display with no active org, real switching (FR-105) when the user has more than one. */
export function OrgSwitcher({ current, others }: { current: OrgOption; others: OrgOption[] }) {
  const { isMobile } = useSidebar();

  if (others.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent console-sa-user">
            <OrgIcon />
            <OrgLabel org={current} />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="console-sa-user data-open:bg-white/5"
              />
            }
          >
            <OrgIcon />
            <OrgLabel org={current} />
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded-[14px] border border-[#e7eaf0] p-1.5 shadow-[0_20px_50px_rgba(16,22,35,0.18)]" align="start" side={isMobile ? "bottom" : "right"} sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9aa6bc]">
                Your organizations
              </DropdownMenuLabel>
              {[current, ...others].map((org) => (
                <form key={org.id} action={switchOrganizationAction.bind(null, org.id)}>
                  <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />} className="gap-2 rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#1c2b46]">
                    <div className="flex size-6 items-center justify-center rounded-md bg-[#f4531f] text-white">
                      <Building2Icon className="size-3.5" />
                    </div>
                    <span className="flex-1 truncate text-left">{org.name}</span>
                    {org.id === current.id ? <Badge variant="secondary">Current</Badge> : null}
                  </DropdownMenuItem>
                </form>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/signup" />} className="gap-2 rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#1c2b46]">
              <div className="flex size-6 items-center justify-center rounded-md bg-[#eef1f6] text-[#48566e]">
                <PlusIcon className="size-4" />
              </div>
              <span className="font-medium text-[#48566e]">Create organization</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function OrgIcon() {
  return (
    <div className="flex aspect-square size-[34px] items-center justify-center rounded-[11px] bg-linear-to-br from-(--brand-sunset) to-[#ff8a50] text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a7 7 0 0 1 0 8" />
        <path d="M9.5 5.5a11 11 0 0 1 0 13" />
        <path d="M13 3a15 15 0 0 1 0 18" />
      </svg>
    </div>
  );
}

function OrgLabel({ org }: { org: OrgOption }) {
  return (
    <div className="grid flex-1 text-left leading-tight">
      <span className="truncate text-[12.5px] font-extrabold text-white">{org.name}</span>
    </div>
  );
}
