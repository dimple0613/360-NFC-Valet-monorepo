export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
}

// Illustrative starter set, not an exhaustive catalog — a real module would
// register its own categories the same way it registers permissions/resource
// types (FR-152/FR-171 pattern) once that registry exists.
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  { key: "security_alerts", label: "Security alerts", description: "New sign-ins, password changes, MFA changes." },
  { key: "billing", label: "Billing", description: "Invoices, payment failures, subscription changes." },
  { key: "member_activity", label: "Member activity", description: "New members joining, roles changing." },
];
