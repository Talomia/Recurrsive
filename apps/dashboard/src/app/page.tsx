import {
  Activity,
  Lightbulb,
  DollarSign,
  Brain,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle,
  Rocket,
  FolderGit2,
  Play,
  ArrowRight,
  ShieldAlert,
  Network,
  BarChart3,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/header";
import MetricCard from "@/components/metric-card";
import ScoreGauge from "@/components/score-gauge";
import TrendChart from "@/components/trend-chart";
import HealthChart from "@/components/health-chart";
import OpportunitiesList from "@/components/opportunities-list";
import {
  getHealthMetrics,
  getTimeline,
  getOpportunities,
  getPerformanceMetrics,
  getProjects,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Welcome / onboarding state — shown when no data is available
// ---------------------------------------------------------------------------

function WelcomeState({ projectCount }: { projectCount: number }) {
  const hasProjects = projectCount > 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Intelligence Overview"
        subtitle="Evidence-backed system health, recommendations, and engineering intelligence"
      />

      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full text-center">
          {/* Welcome hero */}
          <div className="mb-8">
            <div
              className="inline-flex h-20 w-20 items-center justify-center rounded-3xl mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))' }}
            >
              <Rocket className="h-10 w-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-3">
              Welcome to Recurrsive
            </h1>
            <p className="text-base text-text-secondary max-w-lg mx-auto">
              Your engineering intelligence platform. {hasProjects
                ? 'Run your first analysis to populate the dashboard with insights.'
                : 'Start by creating a project, then analyze your codebase.'}
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div
              className={`rounded-2xl p-5 text-left transition-all ${
                hasProjects
                  ? 'border border-green-500/20 bg-green-500/[0.04]'
                  : 'border border-blue-500/20 bg-blue-500/[0.06]'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-3 ${
                hasProjects ? 'bg-green-500/20' : 'bg-blue-500/20'
              }`}>
                {hasProjects ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <FolderGit2 className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                {hasProjects ? 'Projects created' : 'Create a project'}
              </h3>
              <p className="text-xs text-text-secondary">
                {hasProjects
                  ? `${projectCount} project${projectCount !== 1 ? 's' : ''} registered`
                  : 'Register a repository to analyze'}
              </p>
            </div>

            <div
              className={`rounded-2xl p-5 text-left ${
                hasProjects
                  ? 'border border-blue-500/20 bg-blue-500/[0.06]'
                  : 'border border-white/10 bg-white/[0.02] opacity-50'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-3 ${
                hasProjects ? 'bg-blue-500/20' : 'bg-white/10'
              }`}>
                <Play className={`w-4 h-4 ${hasProjects ? 'text-blue-400' : 'text-text-muted'}`} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">Run analysis</h3>
              <p className="text-xs text-text-secondary">Scan for findings, health metrics, and opportunities</p>
            </div>

            <div className="rounded-2xl p-5 text-left border border-white/10 bg-white/[0.02] opacity-50">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl mb-3 bg-white/10">
                <Sparkles className="w-4 h-4 text-text-muted" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">Explore insights</h3>
              <p className="text-xs text-text-secondary">View findings, system maps, and health trends</p>
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            {hasProjects ? (
              <>
                <Play className="w-4 h-4" />
                Go to Projects &amp; Analyze
              </>
            ) : (
              <>
                <FolderGit2 className="w-4 h-4" />
                Create Your First Project
              </>
            )}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>

          {/* Feature highlights */}
          <div className="grid grid-cols-4 gap-4 mt-10 pt-8 border-t border-white/5">
            <div className="text-center">
              <ShieldAlert className="w-5 h-5 mx-auto mb-2 text-amber-400" />
              <p className="text-[11px] font-medium text-text-primary">Security</p>
            </div>
            <div className="text-center">
              <Network className="w-5 h-5 mx-auto mb-2 text-blue-400" />
              <p className="text-[11px] font-medium text-text-primary">Architecture</p>
            </div>
            <div className="text-center">
              <BarChart3 className="w-5 h-5 mx-auto mb-2 text-green-400" />
              <p className="text-[11px] font-medium text-text-primary">Health Score</p>
            </div>
            <div className="text-center">
              <Brain className="w-5 h-5 mx-auto mb-2 text-purple-400" />
              <p className="text-[11px] font-medium text-text-primary">AI Insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main overview page
// ---------------------------------------------------------------------------

export default async function OverviewPage() {
  let health: Awaited<ReturnType<typeof getHealthMetrics>> = { healthScore: 0, healthTrend: 0, qualityScore: 0, qualityTrend: 0, opportunities: 0, newOpportunities: 0, techDebt: 0, techDebtTrend: 0, aiQualityScore: 0, aiQualityTrend: 0 };
  let timeline: Awaited<ReturnType<typeof getTimeline>> = [];
  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  let perfMetrics: Awaited<ReturnType<typeof getPerformanceMetrics>> = [];
  let projectCount = 0;
  let hasData = false;

  try {
    const [h, t, o, p, projects] = await Promise.all([
      getHealthMetrics(),
      getTimeline(),
      getOpportunities(),
      getPerformanceMetrics(),
      getProjects(),
    ]);
    health = h;
    timeline = t;
    opportunities = o;
    perfMetrics = p;
    projectCount = projects.length;

    // Consider data "present" if health score > 0 or we have timeline/findings
    hasData = health.healthScore > 0 || timeline.length > 0 || opportunities.length > 0;
  } catch {
    // Will check hasData below
  }

  // Show welcome/onboarding if no meaningful data yet
  if (!hasData) {
    return <WelcomeState projectCount={projectCount} />;
  }

  const PERF_ICONS = [Clock, Globe, AlertTriangle, CheckCircle];
  const PERF_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#22d3ee"];

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Intelligence Overview"
        subtitle="Evidence-backed system health, recommendations, and engineering intelligence"
      />

      <div className="flex-1 p-6 space-y-6 stagger-children">
        {/* ── Top Metrics Row ──────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Health Score */}
          <div className="glass-card p-5 flex items-center gap-5">
            <ScoreGauge value={health.healthScore} size={90} label="Health" />
            <div className="flex-1">
              <p className="text-xs font-medium text-text-secondary">
                Health Score
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                {health.healthScore}
                <span className="text-sm text-text-muted font-normal">
                  /100
                </span>
              </p>
              <div className="mt-1 flex items-center gap-1">
                <span className={`text-xs font-semibold ${health.healthTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {health.healthTrend >= 0 ? '+' : ''}{health.healthTrend}%
                </span>
                <span className="text-xs text-text-muted">vs last 30d</span>
              </div>
            </div>
          </div>

          {/* Opportunities */}
          <MetricCard
            icon={<Lightbulb className="h-4 w-4 text-amber-400" />}
            label="Opportunities"
            value={health.opportunities}
            trend={12.5}
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
              +{health.newOpportunities} new this week
            </span>
          </MetricCard>

          {/* Tech Debt */}
          <MetricCard
            icon={<DollarSign className="h-4 w-4 text-red-400" />}
            label="Tech Debt Estimate"
            value={`$${(health.techDebt / 1000).toFixed(1)}K`}
            trend={health.techDebtTrend}
          >
            <TrendChart
              data={timeline.slice(-8).map(t => ({ value: Math.round(100 - t.healthScore * 0.3) }))}
              color="#ef4444"
              height={32}
            />
          </MetricCard>

          {/* AI Quality */}
          <MetricCard
            icon={<Brain className="h-4 w-4 text-purple-400" />}
            label="AI Quality Score"
            value={health.aiQualityScore}
            suffix="/100"
            trend={health.aiQualityTrend}
          >
            <TrendChart
              data={timeline.slice(-8).map(t => ({ value: Math.round(t.quality * 0.95 + t.reliability * 0.05) }))}
              color="#8b5cf6"
              height={32}
            />
          </MetricCard>
        </div>

        {/* ── Health Chart + Opportunities ─────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <HealthChart data={timeline} />
          </div>
          <div className="xl:col-span-2">
            <OpportunitiesList opportunities={opportunities} />
          </div>
        </div>

        {/* ── Performance Metrics ──────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Performance Metrics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {perfMetrics.map((metric, i) => {
              const Icon = PERF_ICONS[i] ?? Activity;
              const iconColor = PERF_COLORS[i] ?? "#94a3b8";
              return (
                <MetricCard
                  key={metric.label}
                  icon={<Icon className="h-4 w-4" style={{ color: iconColor }} />}
                  label={metric.label}
                  value={metric.value}
                  suffix={metric.unit}
                  trend={metric.trend}
                >
                  <TrendChart data={metric.data} color={iconColor} height={36} />
                </MetricCard>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
