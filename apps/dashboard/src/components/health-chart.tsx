"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { TimelinePoint } from "@/lib/api";

interface HealthChartProps {
  data: TimelinePoint[];
}

const SERIES = [
  { key: "healthScore", label: "Health Score", color: "#3b82f6" },
  { key: "quality", label: "Quality", color: "#8b5cf6" },
  { key: "reliability", label: "Reliability", color: "#22c55e" },
  { key: "performance", label: "Performance", color: "#22d3ee" },
] as const;

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-surface/95 backdrop-blur-lg px-4 py-3 shadow-2xl">
      <p className="text-xs font-medium text-text-muted mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-xs text-text-secondary">{entry.name}</span>
            <span className="ml-auto text-xs font-semibold text-text-primary tabular-nums">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HealthChart({ data }: HealthChartProps) {
  return (
    <div className="glass-card p-5" role="img" aria-label="System health trend chart showing Health Score, Quality, Reliability, and Performance over the last 30 days">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            System Health Trend
          </h3>
          <p className="text-xs text-text-muted mt-0.5">Last 30 days</p>
        </div>
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-[11px] text-text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            {SERIES.map((s) => (
              <linearGradient
                key={s.key}
                id={`fill-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={["dataMin - 5", 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {SERIES.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: s.color,
                fill: "#0f1629",
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
