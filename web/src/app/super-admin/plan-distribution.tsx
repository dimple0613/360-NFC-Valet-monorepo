import type { PlanDistributionEntry } from "@saasclaude/db";

export function PlanDistribution({ entries }: { entries: PlanDistributionEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-[12.5px] font-semibold text-[#9aa6bc]">No active subscriptions yet.</p>;
  }
  const max = Math.max(...entries.map((e) => e.activeSubscriptions));

  return (
    <div className="flex flex-col gap-[13px]">
      {entries.map((entry) => (
        <div key={entry.planName}>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-[#1c2b46]">{entry.planName}</span>
            <span className="text-[12.5px] font-extrabold text-[#1c2b46]">{entry.activeSubscriptions}</span>
          </div>
          <div className="mt-[6px] h-2 w-full overflow-hidden rounded-[99px] bg-[#f1f3f6]">
            <div
              className="h-full rounded-[99px] bg-[var(--chart-1)]"
              style={{ width: `${Math.max((entry.activeSubscriptions / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}