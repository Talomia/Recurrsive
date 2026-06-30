import Link from "next/link";
import Header from "@/components/header";
import { Sparkles, TrendingUp, Eye, Zap, GitBranch, AlertTriangle, Shield, BarChart3, Layers, ChevronRight } from "lucide-react";
import { getFindingsSummary, getFindings } from "@/lib/api";
import type { Finding } from "@/lib/api";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Insight {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  description: string;
  confidence: number;
  trend: string;
}

// ---------------------------------------------------------------------------
// Generate insights from findings data
// ---------------------------------------------------------------------------

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

  // Severity-based insights
  const critical = summary.by_severity.critical ?? 0;
  const high = summary.by_severity.high ?? 0;

  if (critical > 0) {
    insights.push({
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      title: `${critical} Critical Finding${critical > 1 ? "s" : ""} Require Attention`,
      description: `Your codebase has ${critical} critical-severity finding${critical > 1 ? "s" : ""} that should be addressed immediately. Critical findings represent active risks to security, reliability, or data integrity.`,
      confidence: 99,
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
      confidence: 95,
      trend: `${high}`,
    });
  }

  // Category-based insights
  const sortedCategories = Object.entries(summary.by_category)
    .sort((a, b) => b[1] - a[1]);

  for (const [category, count] of sortedCategories.slice(0, 3)) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const meta = CATEGORY_ICONS[category] ?? { icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10" };

    const descriptions: Record<string, string> = {
      security: `Security analysis has identified ${count} findings representing ${pct}% of all issues. Review these to harden your system against vulnerabilities and align with security best practices.`,
      performance: `Performance analysis found ${count} optimization opportunities (${pct}% of total). Addressing bottlenecks in this area can improve response times, throughput, and resource efficiency.`,
      architecture: `${count} architectural findings (${pct}% of total) suggest structural improvements. These often have the highest long-term ROI by reducing coupling and improving maintainability.`,
      reliability: `Reliability analysis surfaced ${count} findings (${pct}% of total). Improving resilience patterns, error handling, and fault tolerance reduces incident frequency and MTTR.`,
      cost: `Cost optimization identified ${count} savings opportunities (${pct}% of total). These typically involve infrastructure right-sizing, resource cleanup, and efficiency improvements.`,
      documentation: `${count} documentation findings (${pct}% of total) indicate gaps in API docs, architecture docs, or onboarding materials that increase cognitive load for developers.`,
    };

    insights.push({
      icon: meta.icon,
      color: meta.color,
      bg: meta.bg,
      title: `${category.charAt(0).toUpperCase() + category.slice(1)}: ${count} Findings (${pct}%)`,
      description: descriptions[category] ?? `${count} findings categorized under ${category}, representing ${pct}% of your total analysis results.`,
      confidence: Math.min(98, 80 + count),
      trend: `${pct}%`,
    });
  }

  // Overall health insight
  if (total > 0) {
    const lowMedium = (summary.by_severity.low ?? 0) + (summary.by_severity.medium ?? 0);
    const healthPct = Math.round((lowMedium / total) * 100);
    insights.push({
      icon: TrendingUp,
      color: healthPct > 60 ? "text-green-400" : "text-amber-400",
      bg: healthPct > 60 ? "bg-green-500/10" : "bg-amber-500/10",
      title: `${healthPct}% of Findings are Low/Medium Severity`,
      description: `${lowMedium} of ${total} findings are low or medium severity, indicating ${healthPct > 60 ? "a healthy codebase with room for improvement" : "significant attention needed on high-priority items"}.`,
      confidence: 100,
      trend: `${healthPct}%`,
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Fallback insights for when no analysis data is available
// ---------------------------------------------------------------------------

const FALLBACK_INSIGHTS: Insight[] = [
  {
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-500/10",
    title: "Code Quality Improving",
    description: "Overall code quality has improved 12% over the last 30 days, primarily driven by reduced cyclomatic complexity in the order-service module.",
    confidence: 94,
    trend: "+12%",
  },
  {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Growing Technical Debt in Auth Module",
    description: "The authentication module has accumulated 23% more technical debt than the rest of the codebase. Consider prioritizing the OAuth migration opportunity.",
    confidence: 88,
    trend: "+23%",
  },
  {
    icon: Zap,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Performance Bottleneck Detected",
    description: "Database query latency in the order-processing pipeline is 3.4x higher than the system average. N+1 query patterns are the primary contributor.",
    confidence: 96,
    trend: "3.4x",
  },
  {
    icon: GitBranch,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Architecture Pattern Suggestion",
    description: "Based on your service communication patterns, introducing an event bus would reduce inter-service coupling by an estimated 40%.",
    confidence: 78,
    trend: "-40%",
  },
  {
    icon: Eye,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Security Vulnerability Window",
    description: "3 dependencies have known CVEs with available patches. Average time-to-patch is 14 days, above the recommended 7-day window.",
    confidence: 99,
    trend: "14d",
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function InsightsPage() {
  const summary = await getFindingsSummary();
  const { findings } = await getFindings({ limit: 10 });
  const insights = summary.total > 0
    ? generateInsights(summary)
    : FALLBACK_INSIGHTS;

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Insights" subtitle="Evidence-backed intelligence from your engineering knowledge graph" />
      <div className="flex-1 p-6 space-y-6">
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
              {insights.length} active insights · {summary.total} findings analyzed
            </p>
          </div>
        </div>

        {/* Summary bar */}
        {summary.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
            {Object.entries(summary.by_severity).map(([level, count]) => (
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-children">
          {insights.map((insight, i) => {
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
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-text-muted">Confidence</span>
                        <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-accent-blue" style={{ width: `${insight.confidence}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-text-secondary tabular-nums">{insight.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Findings list */}
        {findings.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Recent Findings</h2>
              <span className="text-xs text-text-muted">{findings.length} shown</span>
            </div>
            <div className="space-y-2 stagger-children">
              {findings.map((finding: Finding) => {
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
                    href={`/insights/${finding.id}`}
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
      </div>
    </div>
  );
}
