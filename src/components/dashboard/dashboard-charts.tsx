"use client";

import { type ReactElement, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardStats } from "@/lib/db/queries/dashboard";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type DashboardChartsProps = {
  stats: DashboardStats;
  usedSeats: number;
  billedSeats: number;
  isPro: boolean;
};

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatAgentLabel(name: string) {
  return name.length > 14 ? `${name.slice(0, 14)}…` : name;
}

function ChartFrame({
  height,
  className,
  children,
}: {
  height?: number;
  className?: string;
  children: ReactElement;
}) {
  return (
    <div
      className={cn("w-full min-w-0", className)}
      style={height === undefined ? undefined : { height, minHeight: height }}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardCharts({
  stats,
  usedSeats,
  billedSeats,
  isPro,
}: DashboardChartsProps) {
  const activityData = useMemo(
    () =>
      stats.dailyActivity.map((point) => ({
        ...point,
        label: formatShortDate(point.date),
      })),
    [stats.dailyActivity],
  );

  const agentChartData = useMemo(
    () =>
      stats.agentActivity.map((agent) => ({
        ...agent,
        label: formatAgentLabel(agent.agentName),
      })),
    [stats.agentActivity],
  );

  const statusData = useMemo(
    () =>
      stats.agentStatus.map((entry) => ({
        name: entry.status === "published" ? "Published" : "Draft",
        value: entry.count,
      })),
    [stats.agentStatus],
  );

  const seatUtilization =
    billedSeats > 0 ? Math.min(usedSeats / billedSeats, 1) : 0;
  const seatData = [
    {
      name: "Used",
      value: Math.round(seatUtilization * 100),
      fill: "var(--chart-1)",
    },
  ];

  const hasActivity = activityData.some(
    (point) =>
      point.chatMessages > 0 ||
      point.voiceMinutes > 0 ||
      point.conversations > 0,
  );

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-12">
      <Card className="flex h-full flex-col lg:col-span-8">
        <CardHeader>
          <CardTitle>Activity (30 days)</CardTitle>
          <CardDescription>
            Deployed chat messages, voice minutes, and conversations over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 min-w-0 flex-1">
          {hasActivity ? (
            <ChartFrame className="h-full min-h-[320px]">
              <AreaChart
                data={activityData}
                margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="chatFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                  <linearGradient id="voiceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  className="text-xs fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  className="text-xs fill-muted-foreground"
                />
                <Legend verticalAlign="top" align="right" />
                <Area
                  type="monotone"
                  dataKey="chatMessages"
                  name="Messages"
                  stroke="var(--chart-1)"
                  fill="url(#chatFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="voiceMinutes"
                  name="Voice min"
                  stroke="var(--chart-2)"
                  fill="url(#voiceFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  name="Conversations"
                  stroke="var(--chart-3)"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ChartFrame>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
              No deployed activity yet. Publish an agent to start collecting
              data.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle>Agent seats</CardTitle>
            <CardDescription>
              {isPro
                ? `${usedSeats} agents across ${billedSeats} billed seats`
                : `${usedSeats} of ${billedSeats} trial seats used`}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <ChartFrame height={140}>
              <RadialBarChart
                innerRadius="68%"
                outerRadius="100%"
                data={seatData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={8}
                  background={{ fill: "var(--muted)" }}
                />
              </RadialBarChart>
            </ChartFrame>
            <p className="text-center text-3xl font-semibold tabular-nums">
              {Math.round(seatUtilization * 100)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent status</CardTitle>
            <CardDescription>Published vs draft agents</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {statusData.length > 0 ? (
              <ChartFrame height={180}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={4}
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ChartFrame>
            ) : (
              <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                No agents yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-span-7">
        <CardHeader>
          <CardTitle>Traffic by agent</CardTitle>
          <CardDescription>
            Message and conversation volume per agent
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {agentChartData.length > 0 ? (
            <ChartFrame height={300}>
              <BarChart
                data={agentChartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  className="text-xs fill-muted-foreground"
                />
                <Legend />
                <Bar
                  dataKey="chatMessages"
                  name="Messages"
                  fill="var(--chart-1)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="conversations"
                  name="Conversations"
                  fill="var(--chart-3)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartFrame>
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
              Create an agent to compare traffic across agents.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-5">
        <CardHeader>
          <CardTitle>Platform mix</CardTitle>
          <CardDescription>
            Voice-enabled agents and context coverage
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <ChartFrame height={300}>
            <BarChart
              layout="vertical"
              data={[
                {
                  label: "Voice agents",
                  value: stats.voiceEnabledAgents,
                },
                {
                  label: "Context files",
                  value: stats.totals.contextFiles,
                },
                {
                  label: "Voice minutes",
                  value: stats.totals.voiceMinutes,
                },
              ]}
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} className="stroke-border/60" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={104}
                className="text-xs fill-muted-foreground"
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                <Cell fill="var(--chart-2)" />
                <Cell fill="var(--chart-4)" />
                <Cell fill="var(--chart-5)" />
              </Bar>
            </BarChart>
          </ChartFrame>
        </CardContent>
      </Card>
    </div>
  );
}
