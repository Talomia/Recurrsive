"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { getAnalyticsSummary, getAnalyticsCategories } from "@/lib/api";
import type { AnalyticsSummary, AnalyticsCategory } from "@/lib/api";
import {
  Zap,
  Search as SearchIcon,
  CheckCircle2,
  Heart,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Summary stat card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: typeof Zap;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
      <Icon className={`h-5 w-5 ${color}`} />
      <span className="text-2xl font-bold text-text-primary tabular-nums">
        {value}
      </span>
      <span className="text-[11px] text-text-muted font-medium">{label}</span>
      {subtitle && (
        <span className="text-[10px] text-text-secondary">{subtitle}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category bar
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Security: "bg-red-500",
  Performance: "bg-blue-500",
  Architecture: "bg-purple-500",
  Reliability: "bg-green-500",
  Cost: "bg-amber-500",
  Documentation: "bg-cyan-500",
  Testing: "bg-emerald-500",
  DevOps: "bg-indigo-500",
};

function CategoryBar({ category }: { category: AnalyticsCategory }) {
  const barColor = CATEGORY_COLORS[category.name] ?? "bg-white/20";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-28 shrink-0 truncate">
        {category.name}
      </span>
      <div className="flex-1 h-6 rounded-lg bg-white/5 overflow-hidden relative">
        <div
          className={`h-full rounded-lg ${barColor} opacity-80 transition-all duration-700 ease-out`}
          style={{ width: `${category.percentage * 4}%` }}
        />
        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-medium text-text-secondary tabular-nums">
          {category.count}
        </span>
      </div>
      <span className="text-[10px] text-text-muted w-12 text-right tabular-nums">
        {category.percentage}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Recharts tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-surface/95 backdrop-blur-md px-4 py-3 shadow-xl">
      <p className="text-xs font-medium text-text-primary mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary capitalize">{entry.name}:</span>
          <span className="text-text-primary font-medium tabular-nums">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [categories, setCategories] = useState<AnalyticsCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAnalyticsSummary(), getAnalyticsCategories()])
      .then(([s, c]) => {
        setSummary(s);
        setCategories(c);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header
          title="Analytics & Trends"
          subtitle="Loading analytics data…"
        />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Analytics & Trends"
        subtitle={
          summary
            ? `${summary.analysis_runs} analysis runs · ${summary.total_findings} total findings`
            : "Insights into your codebase over time"
        }
      />

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Failed to load analytics
            </p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Analysis Runs"
            value={summary.analysis_runs}
            icon={Zap}
            color="text-blue-400"
          />
          <SummaryCard
            label="Total Findings"
            value={summary.total_findings}
            icon={SearchIcon}
            color="text-purple-400"
          />
          <SummaryCard
            label="Resolution Rate"
            value={`${summary.resolution_rate}%`}
            icon={CheckCircle2}
            color={
              summary.resolution_rate >= 60
                ? "text-green-400"
                : summary.resolution_rate >= 40
                ? "text-amber-400"
                : "text-red-400"
            }
            subtitle={`${summary.findings_resolved} resolved`}
          />
          <SummaryCard
            label="Avg Health Score"
            value={summary.avg_health_score}
            icon={Heart}
            color={
              summary.avg_health_score >= 80
                ? "text-green-400"
                : summary.avg_health_score >= 60
                ? "text-amber-400"
                : "text-red-400"
            }
          />
        </div>
      )}

      {/* Trend Chart */}
      {summary && summary.trends.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-text-primary">
              12-Week Trend
            </h2>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={summary.trends}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="findingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(v: string) => {
                    const parts = v.split("-");
                    return `${parts[1]}/${parts[2]}`;
                  }}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={
                    <CustomTooltip />
                  }
                />
                <Legend
                  verticalAlign="top"
                  height={30}
                  iconSize={8}
                  formatter={(value: string) => (
                    <span className="text-xs text-text-secondary capitalize">
                      {value}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="findings"
                  stroke="#a78bfa"
                  fill="url(#findingsGrad)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#a78bfa" }}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke="#34d399"
                  fill="url(#resolvedGrad)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#34d399" }}
                />
                <Area
                  type="monotone"
                  dataKey="health"
                  stroke="#60a5fa"
                  fill="url(#healthGrad)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4, fill: "#60a5fa" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Finding Categories
            </h2>
            <span className="text-xs text-text-muted">
              {categories.length} categories
            </span>
          </div>

          <div className="space-y-3">
            {categories.map((cat) => (
              <CategoryBar key={cat.name} category={cat} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
