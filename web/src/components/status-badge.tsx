/**
 * StatusBadge — the shared colored status/label pill used across the Super
 * Admin tables (subscriptions, members, invoices, plans, ...). Single source
 * for the pill look (padding, radius, size, weight) so every status pill
 * renders identically; each caller supplies its own status->color map and the
 * badge falls back to a neutral gray for unknown values.
 */

export interface StatusColor {
  background: string;
  color: string;
}

const DEFAULT_STYLE: StatusColor = { background: "#f1f3f6", color: "#6c7a93" };

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function StatusBadge({
  value,
  styles,
  label,
}: {
  /** The raw status/enum value — also used to look up the color unless `label` is given. */
  value: string;
  /** Map of raw value -> colors. Unknown values get the neutral gray fallback. */
  styles?: Record<string, StatusColor>;
  /** Optional override for the displayed text (defaults to a title-cased `value`). */
  label?: string;
}) {
  const style = (value ? styles?.[value] : undefined) ?? DEFAULT_STYLE;
  const text = label ?? titleCase(value);
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 12px",
        borderRadius: 99,
        fontSize: 10.5,
        fontWeight: 800,
        whiteSpace: "nowrap",
        lineHeight: 1.5,
        background: style.background,
        color: style.color,
      }}
    >
      {text}
    </span>
  );
}

/** Subscription lifecycle status colors (ACTIVE/TRIALING/PAUSED/PAST_DUE/CANCELED/TERMINATED/EXPIRED). */
export const SUBSCRIPTION_STATUS_STYLES: Record<string, StatusColor> = {
  ACTIVE: { background: "#e7f7ef", color: "#0c9d61" },
  TRIALING: { background: "#fdf3e3", color: "#b97b17" },
  PAUSED: { background: "#eef1fb", color: "#4a5fc9" },
  PAST_DUE: { background: "#fdebeb", color: "#e23d3d" },
  CANCELED: { background: "#fbe9f3", color: "#c2188b" },
  TERMINATED: { background: "#f2e6fb", color: "#7a2fd6" },
  EXPIRED: { background: "#f1f3f6", color: "#6c7a93" },
};

/** Organization membership status colors (ACTIVE/INVITED/SUSPENDED). */
export const MEMBERSHIP_STATUS_STYLES: Record<string, StatusColor> = {
  ACTIVE: { background: "#e7f7ef", color: "#0c9d61" },
  INVITED: { background: "#fdf3e3", color: "#b97b17" },
  SUSPENDED: { background: "#fdebeb", color: "#e23d3d" },
};

/** Invoice status colors (DRAFT/ISSUED/PAID/VOID). */
export const INVOICE_STATUS_STYLES: Record<string, StatusColor> = {
  DRAFT: { background: "#f1f3f6", color: "#6c7a93" },
  ISSUED: { background: "#fdf3e3", color: "#b97b17" },
  PAID: { background: "#e7f7ef", color: "#0c9d61" },
  VOID: { background: "#fdebeb", color: "#e23d3d" },
};

/** Plan visibility colors (PUBLIC/INVITE_ONLY/HIDDEN/ARCHIVED). */
export const PLAN_VISIBILITY_STYLES: Record<string, StatusColor> = {
  PUBLIC: { background: "#e7f7ef", color: "#0c9d61" },
  INVITE_ONLY: { background: "#fdf3e3", color: "#b97b17" },
  HIDDEN: { background: "#e7f0fe", color: "#4a5fc9" },
  ARCHIVED: { background: "#f1f3f6", color: "#6c7a93" },
};

/** Organization status colors (ACTIVE/SUSPENDED/ARCHIVED/PENDING_DELETION). */
export const ORG_STATUS_STYLES: Record<string, StatusColor> = {
  ACTIVE: { background: "#e7f7ef", color: "#0c9d61" },
  SUSPENDED: { background: "#fdebeb", color: "#e23d3d" },
  ARCHIVED: { background: "#f1f3f6", color: "#6c7a93" },
  PENDING_DELETION: { background: "#fdf3e3", color: "#b97b17" },
};