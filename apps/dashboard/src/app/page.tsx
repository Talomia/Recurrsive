'use client';

/**
 * Overview page with Executive View toggle.
 *
 * Default view shows the standard intelligence overview.
 * "Executive View" tab shows the executive intelligence dashboard
 * with KPIs, risk assessment, and strategic recommendations.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  Lightbulb,
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
  Loader2,
} from 'lucide-react';
import Header from '@/components/header';
import MetricCard from '@/components/metric-card';
import ScoreGauge from '@/components/score-gauge';
import TrendChart from '@/components/trend-chart';
import HealthChart from '@/components/health-chart';
import OpportunitiesList from '@/components/opportunities-list';
import {
  getHealthMetrics,
  getTimeline,
  getOpportunities,
  getPerformanceMetrics,
  getProjects,
  getFindingsSummary,
  EMPTY_HEALTH_METRICS,
  type HealthMetrics,
  type TimelinePoint,
  type Opportunity,
  type FindingsSummary,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = ['Overview', 'Executive View'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Welcome / onboarding state
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
// Executive view helpers
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function trendInfo(n: number): { icon: string; color: string; label: string } {
  if (n > 0) return { icon: '↑', color: '#22c55e', label: `+${n.toFixed(1)}%` };
  if (n < 0) return { icon: '↓', color: '#ef4444', label: `${n.toFixed(1)}%` };
  return { icon: '→', color: '#6b7280', label: '0%' };
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low': return '#22c55e';
    default: return '#6b7280';
  }
}

function priorityScore(opp: Opportunity): number {
  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return (severityWeight[opp.severity] ?? 1) * opp.confidence;
}

function KPICard({
  title,
  value,
  trend,
  icon,
  gradient,
}: {
  title: string;
  value: string;
  trend?: number;
  icon: string;
  gradient: string;
}) {
  const t = trend !== undefined ? trendInfo(trend) : null;
  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10"
           style={{ background: gradient }} />
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-text-primary">{value}</span>
        {t && (
          <span className="text-sm font-medium mb-1" style={{ color: t.color }}>
            {t.icon} {t.label}
          </span>
        )}
      </div>
    </div>
  );
}

function RiskIndicator({ level, label }: { level: 'low' | 'medium' | 'high' | 'critical'; label: string }) {
  const colors: Record<string, { bg: string; bar: string; text: string }> = {
    low: { bg: 'rgba(34, 197, 94, 0.1)', bar: '#22c55e', text: '#86efac' },
    medium: { bg: 'rgba(234, 179, 8, 0.1)', bar: '#eab308', text: '#fde047' },
    high: { bg: 'rgba(249, 115, 22, 0.1)', bar: '#f97316', text: '#fdba74' },
    critical: { bg: 'rgba(239, 68, 68, 0.1)', bar: '#ef4444', text: '#fca5a5' },
  };
  const c = colors[level] ?? colors.medium;
  const fillPct = level === 'low' ? 25 : level === 'medium' ? 50 : level === 'high' ? 75 : 100;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: c.bg }}>
      <div className="flex-1">
        <span className="text-sm font-medium" style={{ color: c.text }}>{label}</span>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fillPct}%`, background: c.bar }} />
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.bar }}>
        {level}
      </span>
    </div>
  );
}

function StrategicRecommendation({
  title,
  description,
  impact,
  effort,
}: {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}) {
  const impactColors = { high: '#22c55e', medium: '#eab308', low: '#6b7280' };
  const effortColors = { high: '#ef4444', medium: '#eab308', low: '#22c55e' };

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
      <h4 className="text-sm font-semibold text-text-primary mb-1">{title}</h4>
      <p className="text-xs text-text-secondary mb-3">{description}</p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Impact</span>
          <span className="text-[10px] font-bold uppercase" style={{ color: impactColors[impact] }}>{impact}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Effort</span>
          <span className="text-[10px] font-bold uppercase" style={{ color: effortColors[effort] }}>{effort}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page (client wrapper for SSR data)
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [projectCount, setProjectCount] = useState(0);

  // Overview data
  const [health, setHealth] = useState<HealthMetrics>(EMPTY_HEALTH_METRICS);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [perfMetrics, setPerfMetrics] = useState<Awaited<ReturnType<typeof getPerformanceMetrics>>>([]);

  // Executive data (lazy)
  const [execLoading, setExecLoading] = useState(false);
  const [execLoaded, setExecLoaded] = useState(false);
  const [findingsSummary, setFindingsSummary] = useState<FindingsSummary | null>(null);

  // Load overview data. `getHealthMetrics` and `getProjects` throw on a real
  // failure (server down / 5xx) so we can show an error state instead of a
  // misleading "welcome / no data yet" screen. A brand-new but healthy server
  // returns empty data (not an error) → welcome state.
  useEffect(() => {
    (async () => {
      try {
        const [h, projects] = await Promise.all([getHealthMetrics(), getProjects()]);
        // Secondary series are best-effort (they degrade to empty on their own).
        const [t, o, p] = await Promise.all([
          getTimeline(),
          getOpportunities(),
          getPerformanceMetrics(),
        ]);
        setHealth(h);
        setTimeline(t);
        setOpportunities(o);
        setPerfMetrics(p);
        setProjectCount(projects.length);
        setHasData(h.analyzed || t.length > 0 || o.length > 0 || projects.length > 0);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Lazy load executive data
  useEffect(() => {
    if (activeTab !== 'Executive View' || execLoaded) return;
    setExecLoading(true);
    getFindingsSummary()
      .then(setFindingsSummary)
      .catch(() => setFindingsSummary(null))
      .finally(() => { setExecLoading(false); setExecLoaded(true); });
  }, [activeTab, execLoaded]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Intelligence Overview"
          subtitle="Loading dashboard…"
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Intelligence Overview"
          subtitle="Evidence-backed system health, recommendations, and engineering intelligence"
        />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Couldn&apos;t load the dashboard</h2>
            <p className="text-sm text-text-secondary mb-4">
              The analysis server is unreachable or returned an error. This is not the same as
              having no data yet — check that the API server is running.
            </p>
            <p className="text-xs text-text-tertiary font-mono">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return <WelcomeState projectCount={projectCount} />;
  }

  // Executive derived metrics
  const topOpportunities = [...opportunities]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 5);

  const criticalCount = findingsSummary?.by_severity?.critical ?? 0;
  const highCount = findingsSummary?.by_severity?.high ?? 0;
  const totalFindings = findingsSummary?.total ?? 0;

  const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
    criticalCount > 0 ? 'critical'
    : highCount > 5 ? 'high'
    : highCount > 0 ? 'medium'
    : 'low';

  const PERF_ICONS = [Clock, Globe, AlertTriangle, CheckCircle];
  const PERF_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#22d3ee"];

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Intelligence Overview"
        subtitle="Evidence-backed system health, recommendations, and engineering intelligence"
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Tabs */}
        <div
          className="flex items-center gap-1 border-b border-white/10"
          role="tablist"
          aria-label="Overview sections"
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

        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div role="tabpanel" aria-label="Overview" className="space-y-6 stagger-children">
            {/* Top Metrics Row — real, measured values only. No invented
                trends, "new this week" counts, tech-debt dollars, or
                sparklines synthesized from unrelated series. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Health Score */}
              <div className="glass-card p-5 flex items-center gap-5">
                {health.analyzed && health.healthScore != null ? (
                  <>
                    <ScoreGauge value={health.healthScore} size={90} label="Health" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-text-secondary">Health Score</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                        {health.healthScore}
                        <span className="text-sm text-text-muted font-normal">/100</span>
                      </p>
                      {health.analyzedAt && (
                        <p className="mt-1 text-xs text-text-muted">
                          Analyzed {new Date(health.analyzedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1">
                    <p className="text-xs font-medium text-text-secondary">Health Score</p>
                    <p className="mt-1 text-lg font-semibold text-text-secondary">Not analyzed yet</p>
                    <p className="mt-1 text-xs text-text-muted">Run an analysis to compute a score.</p>
                  </div>
                )}
              </div>

              {/* Opportunities — real count */}
              <MetricCard
                icon={<Lightbulb className="h-4 w-4 text-amber-400" />}
                label="Opportunities"
                value={health.opportunityCount}
              />

              {/* Findings — real count (replaces fabricated tech-debt dollars) */}
              <MetricCard
                icon={<ShieldAlert className="h-4 w-4 text-red-400" />}
                label="Findings"
                value={health.findingCount}
              />

              {/* AI Readiness — real dimension score, or no-data */}
              <MetricCard
                icon={<Brain className="h-4 w-4 text-purple-400" />}
                label="AI Readiness"
                value={health.aiQualityScore != null ? health.aiQualityScore : '—'}
                suffix={health.aiQualityScore != null ? '/100' : undefined}
              >
                {health.aiQualityScore == null && (
                  <span className="text-[11px] text-text-muted">No data yet</span>
                )}
              </MetricCard>
            </div>

            {/* Health Chart + Opportunities */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-3">
                <HealthChart data={timeline} />
              </div>
              <div className="xl:col-span-2">
                <OpportunitiesList opportunities={opportunities} />
              </div>
            </div>

            {/* Performance Metrics */}
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
        )}

        {/* Executive View Tab */}
        {activeTab === 'Executive View' && (
          <div role="tabpanel" aria-label="Executive View" className="space-y-6 max-w-7xl mx-auto">
            {execLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                     style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
              </div>
            )}

            {!execLoading && (
              <>
                {/* KPI Row — measured values, no invented trends */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard
                    title="System Health"
                    value={health.healthScore != null ? pct(health.healthScore) : 'Not analyzed'}
                    icon="💚"
                    gradient="linear-gradient(135deg, #22c55e, #16a34a)"
                  />
                  <KPICard
                    title="Code Quality"
                    value={health.qualityScore != null ? pct(health.qualityScore) : '—'}
                    icon="⚡"
                    gradient="linear-gradient(135deg, #3b82f6, #2563eb)"
                  />
                  <KPICard
                    title="AI Readiness"
                    value={health.aiQualityScore != null ? pct(health.aiQualityScore) : '—'}
                    icon="🤖"
                    gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)"
                  />
                  <KPICard
                    title="Total Findings"
                    value={totalFindings || health.findingCount}
                    icon="🛡️"
                    gradient="linear-gradient(135deg, #f97316, #ea580c)"
                  />
                </div>

                {/* Risk Assessment + Strategic Recommendations */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Risk Panel */}
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">Risk Assessment</h3>
                    <div className="space-y-3">
                      <RiskIndicator level={riskLevel} label="Overall Risk Level" />
                      <RiskIndicator
                        level={criticalCount > 0 ? 'critical' : 'low'}
                        label={`Security (${criticalCount} critical)`}
                      />
                      <RiskIndicator
                        level={highCount > 3 ? 'high' : highCount > 0 ? 'medium' : 'low'}
                        label={`Reliability (${highCount} high findings)`}
                      />
                    </div>

                    <div className="mt-4 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-text-primary">{totalFindings}</p>
                        <p className="text-[10px] text-text-tertiary uppercase">Total Findings</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-text-primary">{opportunities.length}</p>
                        <p className="text-[10px] text-text-tertiary uppercase">Opportunities</p>
                      </div>
                    </div>
                  </div>

                  {/* Strategic Recommendations */}
                  <div className="lg:col-span-2 glass-card rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">
                      Strategic Recommendations
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {topOpportunities.length > 0 ? (
                        topOpportunities.map((opp) => (
                          <StrategicRecommendation
                            key={opp.id}
                            title={opp.title}
                            description={(opp.description ?? 'No description').slice(0, 120) + '...'}
                            impact={opp.severity === 'critical' || opp.severity === 'high' ? 'high' : opp.severity === 'medium' ? 'medium' : 'low'}
                            effort={opp.effort > 60 ? 'high' : opp.effort > 30 ? 'medium' : 'low'}
                          />
                        ))
                      ) : (
                        <div className="col-span-2 text-center py-8">
                          <p className="text-sm text-text-secondary">No strategic recommendations available yet.</p>
                          <p className="text-xs text-text-tertiary mt-1">Run an analysis to generate intelligence.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Findings Breakdown */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-text-primary mb-4">Findings Severity Distribution</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                      const count = findingsSummary?.by_severity?.[severity] ?? 0;
                      const pctVal = totalFindings > 0 ? (count / totalFindings) * 100 : 0;
                      return (
                        <div key={severity} className="rounded-xl p-4" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: severityColor(severity) }} />
                            <span className="text-xs font-semibold uppercase text-text-secondary">{severity}</span>
                          </div>
                          <p className="text-2xl font-bold text-text-primary">{count}</p>
                          <div className="mt-2 h-1 w-full rounded-full bg-white/5">
                            <div className="h-full rounded-full transition-all duration-500"
                                 style={{ width: `${pctVal}%`, background: severityColor(severity) }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timeline mini-chart */}
                {timeline.length > 0 && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">Health Score Trend</h3>
                    <div className="flex items-end gap-1 h-20">
                      {timeline.slice(-30).map((point, i) => {
                        const height = Math.max(4, (point.healthScore / 100) * 80);
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-t transition-all duration-300"
                            style={{
                              height: `${height}px`,
                              background: point.healthScore >= 70
                                ? 'linear-gradient(to top, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.8))'
                                : point.healthScore >= 40
                                  ? 'linear-gradient(to top, rgba(234, 179, 8, 0.4), rgba(234, 179, 8, 0.8))'
                                  : 'linear-gradient(to top, rgba(239, 68, 68, 0.4), rgba(239, 68, 68, 0.8))',
                              minWidth: '4px',
                            }}
                            title={`${point.date}: ${point.healthScore}%`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-text-tertiary">
                        {timeline[timeline.length - 30]?.date ?? timeline[0]?.date}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {timeline[timeline.length - 1]?.date}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
