"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SettingsTab {
  label: string;
  href: string;
  /** Match this href exactly rather than as a prefix — needed for the settings index, which every other tab's href sits under. */
  exact?: boolean;
}

export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="-mb-px flex gap-4 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-bold transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
