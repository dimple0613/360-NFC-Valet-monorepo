import { requireValetPage } from "./_lib/valet-permissions";
import { getDashboardData } from "./_lib/valet-data";
import LiveDashboard from "./dashboard/live-dashboard";

export default async function TenantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireValetPage("valet.dashboard.read");
  const raw = await searchParams;
  const days = Number(raw.days) || 7;
  const property = typeof raw.property === "string" ? raw.property : "all";
  const data = await getDashboardData(days, property === "all" ? null : String(property), identity.session.organizationId ?? null);
  const firstName = (identity.user.name || "").split(/\s+/)[0] || "";

  return (
    <LiveDashboard
      initialData={data}
      initialDays={days}
      initialProperty={property}
      firstName={firstName}
    />
  );
}