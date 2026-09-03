"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { GrowthPoint } from "@saasclaude/db";

const chartConfig = {
  totalOrganizations: { label: "Organizations", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function GrowthChart({ points }: { points: GrowthPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <AreaChart data={points} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
              indicator="line"
            />
          }
        />
        <Area
          dataKey="totalOrganizations"
          type="monotone"
          fill="var(--color-totalOrganizations)"
          fillOpacity={0.15}
          stroke="var(--color-totalOrganizations)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
