"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/header";
import ErrorBanner from "@/components/error-banner";
import { getAnalyticsSummary, getAnalyticsCategories, getFindingsSummary, getFindings } from "@/lib/api";
import type { AnalyticsSummary, AnalyticsCategory, Finding } from "@/lib/api";
import {
  Zap,
  Search as SearchIcon,
  CheckCircle2,
  Heart,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Shield,
  GitBranch,
  Eye,
  BarChart3,
  Layers,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
// Shared tab constants
// ---------------------------------------------------------------------------

const TABS = ['Analytics', 'Finding Insights'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Analytics content — Summary stat card
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
// Insights types & helpers
// ---------------------------------------------------------------------------

interface Insight {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  description: string;
  trend: string;
}

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  security: { icon: Shield, color: "text-red-400", bg: "bg-red-500/10" },
  performance: { icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10" },
  architecture: { icon: GitBranch, color: "text-purple-400", bg: "bg-purple-500/10" },
  reliability: { icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  cost: { icon: BarChart3, color: "text-amber-400", bg: "bg-amber-500/10" },
  documentation: { icon: Layers, color: "text-green-400", bg: "bg-green-500/10" },
};

function generateInsights(summary: {
  total: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
}): Insight[] {
  const insights: Insight[] = [];
  const total = summary.total;

  const critical = summary.by_severity.critical ?? 0;
  const high = summary.by_severity.high ?? 0;

  if (critical > 0) {
    insights.push({
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      title: `${critical} Critical Finding${critical > 1 ? "s" : ""} Require Attention`,
      description: `Your codebase has ${critical} critical-severity finding${critical > 1 ? "s" : ""} that should be addressed immediately. Critical findings represent active risks to security, reliability, or data integrity.`,
      trend: `${critical}`,
    });
  }

  if (high > 2) {
    insights.push({
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      title: `${high} High-Priority Findings Identified`,
      description: `${high} findings are rated high severity across your analysis. Addressing these alongside critical items will significantly improve overall system health.`,
      trend: `${high}`,
    });
  }

  const sortedCategories = Object.entries(summary.by_category)
    .sort((a, b) => b[1] - a[1]);

  for (const [category, count] of sortedCategories.slice(0, 3)) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const meta = CATEGORY_ICONS[category] ?? { icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10" };

    const descriptions: Record<string, string> = {
      security: `Security analysis has identified ${count} findings representing ${pct}% of all issues.`,
      performance: `Performance analysis found ${count} optimization opportunities (${pct}% of total).`,
      architecture: `${count} architectural findings (${pct}% of total) suggest structural improvements.`,
      reliability: `Reliability analysis surfaced ${count} findings (${pct}% of total).`,
      cost: `Cost optimization identified ${count} savings opportunities (${pct}% of total).`,
      documentation: `${count} documentation findings (${pct}% of total) indicate gaps.`,
    };

    insights.push({
      icon: meta.icon,
      color: meta.color,
      bg: meta.bg,
      title: `${category.charAt(0).toUpperCase() + category.slice(1)}: ${count} Findings (${pct}%)`,
      description: descriptions[category] ?? `${count} findings categorized under ${category}, representing ${pct}% of your total analysis results.`,
      trend: `${pct}%`,
    });
  }

  if (total > 0) {
    const lowMedium = (summary.by_severity.low ?? 0) + (summary.by_severity.medium ?? 0);
    const healthPct = Math.round((lowMedium / total) * 100);
    insights.push({
      icon: TrendingUp,
      color: healthPct > 60 ? "text-green-400" : "text-amber-400",
      bg: healthPct > 60 ? "bg-green-500/10" : "bg-amber-500/10",
      title: `${healthPct}% of Findings are Low/Medium Severity`,
      description: `${lowMedium} of ${total} findings are low or medium severity, indicating ${healthPct > 60 ? "a healthy codebase with room for improvement" : "significant attention needed on high-priority items"}.`,
      trend: `${healthPct}%`,
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Analytics');

  // Analytics state
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [categories, setCategories] = useState<AnalyticsCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Insights state
  const [insightsData, setInsightsData] = useState<{
    insights: Insight[];
    summary: { total: number; by_severity: Record<string, number>; by_category: Record<string, number> } | null;
    findings: Finding[];
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Fetch analytics data
  useEffect(() => {
    let cancelled = false;
    Promise.all([getAnalyticsSummary(), getAnalyticsCategories()])
      .then(([s, c]) => {
        if (!cancelled) { setSummary(s); setCategories(c); }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch insights data lazily
  useEffect(() => {
    if (activeTab !== 'Finding Insights' || insightsData) return;
    setInsightsLoading(true);
    Promise.all([getFindingsSummary(), getFindings({ limit: 10 })])
      .then(([fSummary, fData]) => {
        const insights = fSummary.total > 0 ? generateInsights(fSummary) : [];
        setInsightsData({ insights, summary: fSummary, findings: fData.findings });
      })
      .catch(() => {
        setInsightsError('Failed to load insights data.');
        setInsightsData({ insights: [], summary: null, findings: [] });
      })
      .finally(() => setInsightsLoading(false));
  }, [activeTab, insightsData]);

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

      {/* Tabs */}
      <div
        className="flex items-center gap-1 border-b border-white/10"
        role="tablist"
        aria-label="Analytics sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'Analytics' && (
        <div role="tabpanel" aria-label="Analytics" className="space-y-6">
          {/* Error state */}
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

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
                  Recorded Analysis Trend
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
      )}

      {activeTab === 'Finding Insights' && (
        <div role="tabpanel" aria-label="Finding Insights" className="space-y-6">
          {insightsLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            </div>
          )}

          {insightsError && <ErrorBanner message={insightsError} onDismiss={() => setInsightsError(null)} />}

          {insightsData && !insightsLoading && (
            <>
              {/* Hero */}
              <div className="glass-card p-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple to-accent-blue">
                  <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    AI-Generated Insights
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {insightsData.insights.length} active insights · {insightsData.summary?.total ?? 0} findings analyzed
                  </p>
                </div>
              </div>

              {/* Summary bar */}
              {insightsData.summary && insightsData.summary.total > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(insightsData.summary.by_severity).map(([level, count]) => (
                    <div key={level} className="glass-card p-3 flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        level === "critical" ? "bg-red-500" :
                        level === "high" ? "bg-amber-500" :
                        level === "medium" ? "bg-blue-500" : "bg-green-500"
                      }`} />
                      <div>
                        <p className="text-lg font-bold text-text-primary tabular-nums">{count}</p>
                        <p className="text-[10px] text-text-muted capitalize">{level}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Insights grid */}
              {insightsData.insights.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {insightsData.insights.map((insight, i) => {
                    const Icon = insight.icon;
                    return (
                      <div key={i} className="glass-card p-5 hover:scale-[1.01] transition-transform duration-200">
                        <div className="flex items-start gap-4">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${insight.bg}`}>
                            <Icon className={`h-5 w-5 ${insight.color}`} aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-sm font-semibold text-text-primary">{insight.title}</h3>
                              <span className={`text-xs font-bold tabular-nums ${insight.color}`}>{insight.trend}</span>
                            </div>
                            <p className="mt-2 text-sm text-text-secondary leading-relaxed">{insight.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-card p-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mx-auto mb-5">
                    <Sparkles className="h-7 w-7 text-text-muted" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">No insights generated yet</h3>
                  <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
                    Insights are generated from analysis findings. Run an analysis on your project to discover patterns and recommendations.
                  </p>
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/20 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-accent-blue/20 transition-colors"
                  >
                    Go to Projects
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {/* Recent Findings list */}
              {insightsData.findings.length > 0 && (
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-text-primary">Recent Findings</h2>
                    <span className="text-xs text-text-muted">{insightsData.findings.length} shown</span>
                  </div>
                  <div className="space-y-2">
                    {insightsData.findings.map((finding: Finding) => {
                      const sevColor: Record<string, string> = {
                        critical: "bg-red-500",
                        high: "bg-orange-500",
                        medium: "bg-amber-500",
                        low: "bg-green-500",
                        info: "bg-blue-500",
                      };
                      return (
                        <Link
                          key={finding.id}
                          href={`/findings/${finding.id}`}
                          className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-3 hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                        >
                          <div className={`h-2 w-2 rounded-full shrink-0 ${sevColor[finding.severity] ?? "bg-blue-500"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                              {finding.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-text-muted capitalize">{finding.category.replace(/_/g, " ")}</span>
                              <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
                              <span className="text-[10px] text-text-muted">{finding.analyzer_id}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-text-muted shrink-0 group-hover:text-text-secondary transition-colors" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
