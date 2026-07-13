import Link from "next/link";
import Header from "@/components/header";
import { Sparkles, TrendingUp, Eye, Zap, GitBranch, AlertTriangle, Shield, BarChart3, Layers, ChevronRight, ArrowRight } from "lucide-react";
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
  value: string;
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
      description: `${critical} finding${critical > 1 ? "s are" : " is"} classified as critical by the enabled analyzers. Review the underlying evidence and remediation guidance.`,
      value: `${critical}`,
    });
  }

  if (high > 2) {
    insights.push({
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      title: `${high} High-Priority Findings Identified`,
      description: `${high} findings are classified as high severity by the enabled analyzers.`,
      value: `${high}`,
    });
  }

  // Category-based insights
  const sortedCategories = Object.entries(summary.by_category)
    .sort((a, b) => b[1] - a[1]);

  for (const [category, count] of sortedCategories.slice(0, 3)) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const meta = CATEGORY_ICONS[category] ?? { icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10" };

    insights.push({
      icon: meta.icon,
      color: meta.color,
      bg: meta.bg,
      title: `${category.charAt(0).toUpperCase() + category.slice(1)}: ${count} Findings (${pct}%)`,
      description: `${count} of ${total} findings are categorized as ${category.replace(/_/g, " ")}.`,
      value: `${pct}%`,
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
      description: `${lowMedium} of ${total} findings are classified as low or medium severity.`,
      value: `${healthPct}%`,
    });
  }

  return insights;
}



// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (!projectId) return null;
  try {
    const summary = await getFindingsSummary(projectId);
    const { findings } = await getFindings({ limit: 10, projectId });
    const insights = summary.total > 0
      ? generateInsights(summary)
      : [];

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
                Finding Patterns
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
          {insights.length > 0 ? (
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
                          <span className={`text-xs font-bold tabular-nums ${insight.color}`}>{insight.value}</span>
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
                    Patterns are derived from analysis findings. Run an analysis to populate this view.
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
                      href={`/insights/${finding.id}?projectId=${encodeURIComponent(projectId)}`}
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
  } catch {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Insights" subtitle="Evidence-backed intelligence from your engineering knowledge graph" />
        <div className="flex-1 p-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-text-muted">
            Unable to load data. The API may be unavailable.
          </div>
        </div>
      </div>
    );
  }
}
