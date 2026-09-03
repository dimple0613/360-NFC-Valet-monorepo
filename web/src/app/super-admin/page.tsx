import Link from "next/link";
import {
  countActiveMembers,
  countActiveSubscriptions,
  countOrganizations,
  getOrganizationGrowth,
  getPlanDistribution,
  getUserPlatformPermissions,
  listRecentActivity,
  listRecentCustomers,
  listRecentSubscriptions,
} from "@saasclaude/db";
import {
  Building2Icon,
  CreditCardIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { StatusBadge, ORG_STATUS_STYLES, SUBSCRIPTION_STATUS_STYLES } from "@/components/status-badge";
import { requireIdentity } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { GrowthChart } from "./growth-chart";
import { PlanDistribution } from "./plan-distribution";

type ActivityEntry = Awaited<ReturnType<typeof listRecentActivity>>[number];

const ACTIVITY_DOT: Record<string, string> = {
  "organization.created": "#F4531F",
  "organization.member_invited": "#4A5FC9",
  "subscription.created": "#0C9D61",
  "invoice.issued": "#E9A23B",
};

function dotColor(action: string): string {
  return ACTIVITY_DOT[action] ?? "#9AA6BC";
}

function timeAgo(date: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString();
}

function activityText(entry: ActivityEntry): string {
  const org = entry.organizationName === "Unknown" ? "" : ` · ${entry.organizationName}`;
  const actor = entry.actorEmail ? ` · ${entry.actorEmail}` : "";
  return `${entry.action}${org}${actor}`;
}

const SECTION_CARD = "rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]";

function StatCard({
  label,
  icon,
  iconBg,
  iconColor,
  value,
  delta,
  deltaTone = "up",
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: "up" | "amber" | "down";
}) {
  return (
    <div className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#6c7a93]">{label}</span>
        <div
          className="flex size-[34px] flex-none items-center justify-center rounded-[11px]"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <div className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.5px] text-[#16213a]">{value}</div>
      {delta ? (
        <div
          className="mt-1.5 text-[11.5px] font-bold"
          style={{ color: deltaTone === "up" ? "#0C9D61" : deltaTone === "amber" ? "#B97B17" : "#C0392B" }}
        >
          {delta}
        </div>
      ) : null}
    </div>
  );
}

export default async function SuperAdminDashboardPage() {
  const identity = await requireIdentity();
  const permissions = await getUserPlatformPermissions(identity.session.userId);
  const canViewOrganizations = permissions.includes("core.platform.manage_organizations");
  const canViewBilling = permissions.includes("core.platform.view_billing");

  const [growth, planDistribution, recentSubscriptions, recentCustomers, recentActivity, totalOrgs, activeSubs, activeMembers] =
    await Promise.all([
      canViewOrganizations ? getOrganizationGrowth(30) : Promise.resolve(null),
      canViewBilling ? getPlanDistribution() : Promise.resolve(null),
      canViewBilling ? listRecentSubscriptions(8) : Promise.resolve(null),
      canViewOrganizations ? listRecentCustomers(8) : Promise.resolve(null),
      canViewOrganizations ? listRecentActivity(10) : Promise.resolve(null),
      canViewOrganizations ? countOrganizations() : Promise.resolve(null),
      canViewBilling ? countActiveSubscriptions() : Promise.resolve(null),
      countActiveMembers(),
    ]);

  const activeSubsTotal = planDistribution
    ? planDistribution.reduce((sum, entry) => sum + entry.activeSubscriptions, 0)
    : null;

  const firstName = (identity.user.name ?? identity.user.email).split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[21px] font-extrabold tracking-[-0.3px] text-[#16213a]">
            {greeting}, {firstName}
          </div>
          <div className="mt-0.5 text-[12.5px] font-semibold text-[#6c7a93]">{dateStr} · All systems healthy</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totalOrgs !== null ? (
          <StatCard
            label="Organizations"
            icon={<Building2Icon size={17} />}
            iconBg="#FEEFE8"
            iconColor="#F4531F"
            value={totalOrgs}
            delta="▲ Across the platform"
          />
        ) : null}
        {activeSubsTotal !== null && activeSubs !== null ? (
          <StatCard
            label="Active subscriptions"
            icon={<CreditCardIcon size={17} />}
            iconBg="#E7F7EF"
            iconColor="#0C9D61"
            value={activeSubs}
            delta={`▲ ${activeSubsTotal} on a charged plan`}
          />
        ) : null}
        <StatCard
          label="Members"
          icon={<UsersIcon size={17} color="#4A5FC9" />}
          iconBg="#EDF0FE"
          iconColor="#4A5FC9"
          value={activeMembers}
          delta="▲ Active across all orgs"
        />
        {canViewOrganizations ? (
          <StatCard
            label="Growth (30d)"
            icon={<TrendingUpIcon size={17} color="#B97B17" />}
            iconBg="#FDF3E3"
            iconColor="#B97B17"
            value={growth && growth.length > 0 ? growth[growth.length - 1].totalOrganizations : 0}
            delta="▲ Total organizations"
          />
        ) : null}
      </div>

      {growth || planDistribution ? (
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          {growth ? (
            <div className={SECTION_CARD}>
              <span className="text-[14.5px] font-extrabold text-[#16213a]">Customer growth</span>
              <div className="mt-3">
                <GrowthChart points={growth} />
              </div>
            </div>
          ) : null}
          {planDistribution ? (
            <div className={SECTION_CARD}>
              <span className="text-[14.5px] font-extrabold text-[#16213a]">Active subscriptions by plan</span>
              <div className="mt-[16px]">
                <PlanDistribution entries={planDistribution} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {recentSubscriptions ? (
          <div className={SECTION_CARD}>
            <span className="text-[14.5px] font-extrabold text-[#16213a]">Recent subscriptions</span>
            <div className="mt-3 overflow-hidden rounded-[18px] border border-[#e7eaf0] bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Organization", "Plan", "Status"].map((h) => (
                      <th
                        key={h}
                        className="border-b border-[#edeff3] bg-[#fafbfc] px-4 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[1.2px] whitespace-nowrap select-none"
                        style={{ color: "#6c7a93" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-center text-[12.5px] font-semibold" style={{ color: "#9aa6bc" }}>
                        No subscriptions yet.
                      </td>
                    </tr>
                  ) : (
                    recentSubscriptions.slice(0, 10).map((sub) => (
                      <tr key={sub.id} className="border-b border-[#f1f3f6] last:border-b-0">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex" style={{ gap: "11px", alignItems: "center" }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: "#edf0fe",
                                color: "#4a5fc9",
                                fontSize: 12,
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {sub.organizationName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <Link
                                href={`/super-admin/organizations/${sub.organizationId}`}
                                className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
                              >
                                {sub.organizationName}
                              </Link>
                              <div className="text-[11px] font-semibold text-[#6c7a93]" style={{ marginTop: 1 }}>
                                {sub.memberCount} {sub.memberCount === 1 ? "user" : "users"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="text-[13px] font-bold text-[#1c2b46]">{sub.planName}</div>
                          <p className="text-[11px] font-semibold text-[#6c7a93]">Current plan</p>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <StatusBadge value={sub.status} styles={SUBSCRIPTION_STATUS_STYLES} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {recentCustomers ? (
          <div className={SECTION_CARD}>
            <span className="text-[14.5px] font-extrabold text-[#16213a]">Recent customers</span>
            <div className="mt-3 overflow-hidden rounded-[18px] border border-[#e7eaf0] bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Organization", "Status", "Created"].map((h) => (
                      <th
                        key={h}
                        className="border-b border-[#edeff3] bg-[#fafbfc] px-4 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[1.2px] whitespace-nowrap select-none"
                        style={{ color: "#6c7a93" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-center text-[12.5px] font-semibold" style={{ color: "#9aa6bc" }}>
                        No customers yet.
                      </td>
                    </tr>
                  ) : (
                    recentCustomers.slice(0, 10).map((customer) => (
                      <tr key={customer.id} className="border-b border-[#f1f3f6] last:border-b-0">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex" style={{ gap: "11px", alignItems: "center" }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: "#edf0fe",
                                color: "#4a5fc9",
                                fontSize: 12,
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {customer.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <Link
                                href={`/super-admin/organizations/${customer.id}`}
                                className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
                              >
                                {customer.name}
                              </Link>
                              <div className="text-[11px] font-semibold text-[#6c7a93]" style={{ marginTop: 1 }}>
                                {customer.memberCount} {customer.memberCount === 1 ? "user" : "users"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <StatusBadge value={customer.status} styles={ORG_STATUS_STYLES} />
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-[12.5px] font-semibold" style={{ color: "#6c7a93" }}>
                          {formatDate(customer.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {recentActivity ? (
        <div className={SECTION_CARD}>
          <div className="mb-4 text-[15px] font-extrabold">Recent activity</div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-[26px] sm:grid-cols-2">
              {recentActivity.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-[11px] py-[9px]"
                  style={{
                    borderBottom:
                      i < recentActivity.length - (recentActivity.length % 2) ? "1px solid #F1F3F6" : "none",
                  }}
                >
                  <div className="size-2 flex-none rounded-full" style={{ background: dotColor(entry.action) }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#1c2b46]">
                    {activityText(entry)}
                  </span>
                  <span className="flex-none text-[11px] font-semibold text-[#9aa6bc]">{timeAgo(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}