/**
 * Shared display formatters for the Super Admin / Tenant Admin portals.
 * Central place for consistent date, time, and price formatting — import these
 * instead of inlining toLocaleString/toLocaleDateString calls per component.
 * Dates use a FIXED format (not the browser/OS locale), so the same value
 * renders identically everywhere.
 */

/** Formats integer cents + ISO currency into a localized price, e.g. 4900 -> "$49.00". */
export function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Formats "DD MMM YYYY" (e.g. "01 Sep 2026") using a fixed English month
 * table — intentionally NOT locale-dependent, so the same Date renders
 * identically in every browser/OS regardless of the user's current locale.
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getDate())} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Formats "DD MMM YYYY, HH:MM" (e.g. "01 Sep 2026, 11:57") using a fixed
 * English month table and 24-hour clock — locale-independent and stable.
 */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getDate())} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Title-cases an enum/slug-style value: "PAST_DUE" -> "Past Due", "invoice.paid" -> "Invoice Paid". */
export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}