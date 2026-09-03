import { Fragment } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { IconTile } from "@/components/icon-tile";

export interface Crumb {
  label: string;
  /** Omit on the last crumb — it renders as the current page. */
  href?: string;
}

/**
 * The standard portal page header: an optional breadcrumb trail above a
 * `text-title` heading. When an `icon` is given it renders inside an
 * `IconTile` beside the title (the design reference's section-icon style);
 * `titleTrailing` (e.g. a status Badge) sits inline after the title,
 * `description` sits below the icon+title row, and `actions` is right-aligned.
 * Replaces the hand-rolled `<nav>` + `<h1>` blocks that had drifted across
 * the Super Admin pages.
 */
export function PageHeader({
  crumbs,
  icon,
  title,
  titleTrailing,
  description,
  actions,
}: {
  crumbs?: Crumb[];
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Rendered inline right after the title text — e.g. a status Badge. */
  titleTrailing?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {crumbs && crumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? <BreadcrumbSeparator /> : null}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            {icon ? <IconTile size="md">{icon}</IconTile> : null}
            <div>
              <h1 className="flex items-center gap-2 text-title">
                {title}
                {titleTrailing}
              </h1>
              {description ? (
                <p
                  className="max-w-prose text-sm text-muted-foreground"
                  style={{
                    color: "var(--text-secondary)",
                    marginTop: 2,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
