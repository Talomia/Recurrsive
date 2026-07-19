'use client';

/**
 * Overview — the scope-aware orientation hub.
 *
 * Two-tier scope model:
 * - WORKSPACE scope (no `?projectId=`): a portfolio home summarizing health
 *   and open work across ALL projects, with a projects grid to enter one.
 * - PROJECT scope (`?projectId=` present): a focused per-project hub with the
 *   project's real health score, findings-by-severity, top open findings and
 *   opportunities, and one-click paths through the primary journey:
 *   Analyze → Findings / Opportunities → detail.
 *
 * Every number is a real API value; loading, error, and empty states are
 * honest and distinct. Zero projects → a single-CTA onboarding state.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Play,
  ArrowRight,
  ShieldAlert,
  Lightbulb,
  Network,
  FolderGit2,
  Rocket,
  CheckCircle,
  Sparkles,
  BarChart3,
  Brain,
  ChevronRight,
  HeartPulse,
  Clock,
} from 'lucide-react';
import Header from '@/components/header';
import ScoreGauge from '@/components/score-gauge';
import HealthChart from '@/components/health-chart';
import OpportunitiesList from '@/components/opportunities-list';
import ErrorBanner from '@/components/error-banner';
import LoadingSkeleton from '@/components/loading-skeleton';
import EmptyState from '@/components/ui/empty-state';
import { useActiveProject } from '@/components/active-project-context';
import { scopedHref } from '@/lib/project-links';
import {
  getHealthMetrics,
  getTimeline,
  getOpportunities,
  getProjects,
  getFindingsPage,
  apiFetch,
  EMPTY_HEALTH_METRICS,
  type HealthMetrics,
  type TimelinePoint,
  type Opportunity,
  type FindingsPageData,
  type Project,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

interface SectionState<T> {
  data: T | null;
  error: string | null;
}

function settle<T>(result: PromiseSettledResult<T>, fallback: string): SectionState<T> {
  if (result.status === 'fulfilled') return { data: result.value, error: null };
  return {
    data: null,
    error: result.reason instanceof Error ? result.reason.message : fallback,
  };
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_DOTS: Record<string, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-green-400',
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-green-400',
};

function priorityScore(opp: Opportunity): number {
  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return (severityWeight[opp.severity] ?? 1) * opp.confidence;
}

/** Card header with title + "view all" style link. */
function CardHeader({ title, linkLabel, href }: { title: string; linkLabel?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {linkLabel && href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:text-blue-300 transition-colors"
        >
          {linkLabel}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding state — zero projects (or nothing analyzed anywhere yet)
// ---------------------------------------------------------------------------

function WelcomeState({ projectCount }: { projectCount: number }) {
  const hasProjects = projectCount > 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Overview"
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
            <h2 className="text-3xl font-bold text-text-primary mb-3">
              Welcome to Recurrsive
            </h2>
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

// ═══════════════════════════════════════════════════════════════════════════
// WORKSPACE SCOPE — portfolio home across all projects
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal shapes returned by the per-project findings/opportunities routes. */
interface PortfolioFinding {
  severity: string;
  status: string;
}

interface PortfolioStats {
  /** Open findings across all analyzed projects, by severity. */
  bySeverity: { critical: number; high: number; medium: number; low: number };
  openFindings: number;
  opportunities: number;
  /** Per-project rollup for the projects grid. */
  perProject: Record<string, { openFindings: number; opportunities: number }>;
  /** Number of analyzed projects whose stats failed to load. */
  failedProjects: number;
}

const EMPTY_PORTFOLIO_STATS: PortfolioStats = {
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
  openFindings: 0,
  opportunities: 0,
  perProject: {},
  failedProjects: 0,
};

function ProjectHealthBadge({ project }: { project: Project }) {
  if (!project.lastAnalysis) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-white/5 text-text-muted border-white/10">
        Not analyzed
      </span>
    );
  }
  const color = project.healthScore >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : project.healthScore >= 60 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border tabular-nums ${color}`}>
      {project.healthScore}
    </span>
  );
}

function WorkspaceOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<SectionState<PortfolioStats>>({ data: null, error: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projs = await getProjects();
      setProjects(projs);

      // Aggregate real per-project findings/opportunities for analyzed projects.
      const analyzed = projs.filter((p) => p.lastAnalysis);
      if (analyzed.length === 0) {
        setStats({ data: EMPTY_PORTFOLIO_STATS, error: null });
        return;
      }

      const results = await Promise.allSettled(
        analyzed.map(async (p) => {
          const [findings, opps] = await Promise.all([
            apiFetch<PortfolioFinding[]>(`/api/v1/projects/${encodeURIComponent(p.id)}/findings`),
            apiFetch<unknown[]>(`/api/v1/projects/${encodeURIComponent(p.id)}/opportunities`),
          ]);
          return { id: p.id, findings, opportunityCount: opps.length };
        }),
      );

      const agg: PortfolioStats = {
        ...EMPTY_PORTFOLIO_STATS,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        perProject: {},
      };
      let anyFulfilled = false;
      for (const r of results) {
        if (r.status !== 'fulfilled') {
          agg.failedProjects += 1;
          continue;
        }
        anyFulfilled = true;
        const open = r.value.findings.filter((f) => f.status === 'open');
        agg.openFindings += open.length;
        agg.opportunities += r.value.opportunityCount;
        for (const f of open) {
          if (f.severity in agg.bySeverity) {
            agg.bySeverity[f.severity as keyof PortfolioStats['bySeverity']] += 1;
          }
        }
        agg.perProject[r.value.id] = {
          openFindings: open.length,
          opportunities: r.value.opportunityCount,
        };
      }

      if (!anyFulfilled) {
        setStats({ data: null, error: 'Failed to load portfolio findings and opportunities.' });
      } else {
        setStats({ data: agg, error: null });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the workspace overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <LoadingSkeleton variant="page" />;
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Overview" subtitle="Workspace portfolio across all projects" />
        <div className="flex-1 p-6">
          <ErrorBanner
            message={`${error} — the analysis server is unreachable or returned an error. This is not the same as having no data yet.`}
            onRetry={() => void load()}
          />
        </div>
      </div>
    );
  }

  // Zero projects → single-CTA onboarding.
  if (projects.length === 0) {
    return <WelcomeState projectCount={0} />;
  }

  const analyzed = projects.filter((p) => p.lastAnalysis);
  const avgHealth = analyzed.length > 0
    ? Math.round(analyzed.reduce((sum, p) => sum + p.healthScore, 0) / analyzed.length)
    : null;
  const recentlyAnalyzed = [...analyzed]
    .sort((a, b) => (b.lastAnalysis ?? '').localeCompare(a.lastAnalysis ?? ''))
    .slice(0, 5);

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Overview"
        subtitle={`Workspace portfolio — ${projects.length} project${projects.length !== 1 ? 's' : ''}, ${analyzed.length} analyzed`}
        primaryAction={{ label: 'Analyze a Repository', href: '/projects', icon: Play }}
      />

      <div className="flex-1 p-6 space-y-6 stagger-children">
        {/* Row 1: portfolio summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Portfolio health */}
          <div className="glass-card p-5 flex flex-col">
            <CardHeader title="Portfolio Health" linkLabel="All projects" href="/projects" />
            {avgHealth != null ? (
              <div className="flex items-center gap-5 flex-1">
                <ScoreGauge value={avgHealth} size={104} label="Avg" />
                <div className="min-w-0">
                  <p className="text-3xl font-bold tabular-nums text-text-primary">
                    {avgHealth}
                    <span className="text-sm text-text-muted font-normal">/100</span>
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Average across {analyzed.length} analyzed project{analyzed.length !== 1 ? 's' : ''}
                  </p>
                  {projects.length > analyzed.length && (
                    <p className="mt-1 text-xs text-text-muted">
                      {projects.length - analyzed.length} not analyzed yet
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-start justify-center gap-2">
                <div className="flex items-center gap-2 text-text-secondary">
                  <HeartPulse className="h-5 w-5 text-text-muted" aria-hidden="true" />
                  <p className="text-sm font-medium">No analyses yet</p>
                </div>
                <p className="text-xs text-text-muted">Analyze a project to compute health scores.</p>
                <Link
                  href="/projects"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-blue-300 transition-colors"
                >
                  <Play className="h-3 w-3" aria-hidden="true" />
                  Run first analysis
                </Link>
              </div>
            )}
          </div>

          {/* Open findings across portfolio */}
          <div className="glass-card p-5 flex flex-col">
            <CardHeader title="Open Findings" />
            {stats.error ? (
              <ErrorBanner message={stats.error} onRetry={() => void load()} compact />
            ) : !stats.data || analyzed.length === 0 ? (
              <div className="flex-1 flex flex-col items-start justify-center gap-2">
                <p className="text-sm font-medium text-text-secondary">Nothing scanned yet</p>
                <p className="text-xs text-text-muted">Findings appear here after your first analysis.</p>
              </div>
            ) : stats.data.openFindings === 0 ? (
              <div className="flex-1 flex flex-col items-start justify-center gap-2">
                <p className="text-sm font-medium text-text-secondary">No open findings</p>
                <p className="text-xs text-text-muted">
                  Nothing open across {analyzed.length} analyzed project{analyzed.length !== 1 ? 's' : ''}.
                </p>
                {stats.data.failedProjects > 0 && (
                  <p className="text-[11px] text-amber-400/80">
                    Stats unavailable for {stats.data.failedProjects} project{stats.data.failedProjects !== 1 ? 's' : ''}.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center gap-2">
                {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                  const count = stats.data!.bySeverity[severity];
                  const pctVal = stats.data!.openFindings > 0
                    ? Math.round((count / stats.data!.openFindings) * 100)
                    : 0;
                  return (
                    <div key={severity} className="flex items-center gap-3 px-2 py-1 -mx-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${SEVERITY_DOTS[severity]}`} aria-hidden="true" />
                      <span className="text-xs font-medium capitalize text-text-secondary w-16">{severity}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
                        <div className={`h-full rounded-full ${SEVERITY_DOTS[severity]}`} style={{ width: `${pctVal}%` }} />
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${SEVERITY_TEXT[severity]}`}>{count}</span>
                    </div>
                  );
                })}
                <p className="mt-1 text-[11px] text-text-muted">
                  {stats.data.openFindings} open across the portfolio
                  {stats.data.failedProjects > 0 && ` · ${stats.data.failedProjects} project${stats.data.failedProjects !== 1 ? 's' : ''} unavailable`}
                </p>
              </div>
            )}
          </div>

          {/* Opportunities across portfolio */}
          <div className="glass-card p-5 flex flex-col">
            <CardHeader title="Opportunities" />
            {stats.error ? (
              <ErrorBanner message={stats.error} onRetry={() => void load()} compact />
            ) : !stats.data || analyzed.length === 0 ? (
              <div className="flex-1 flex flex-col items-start justify-center gap-2">
                <p className="text-sm font-medium text-text-secondary">Nothing discovered yet</p>
                <p className="text-xs text-text-muted">Opportunities appear here after your first analysis.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-start justify-center gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <Lightbulb className="h-5 w-5 text-purple-400" aria-hidden="true" />
                  </span>
                  <p className="text-3xl font-bold tabular-nums text-text-primary">{stats.data.opportunities}</p>
                </div>
                <p className="text-xs text-text-muted">
                  Improvement opportunities across {analyzed.length} analyzed project{analyzed.length !== 1 ? 's' : ''}.
                </p>
                <p className="text-[11px] text-text-muted">Enter a project below to review and act on them.</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: projects grid — the way into project scope */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Projects</h3>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:text-blue-300 transition-colors"
            >
              Manage projects
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => {
              const projectStats = stats.data?.perProject[project.id];
              return (
                <Link
                  key={project.id}
                  href={`/?projectId=${encodeURIComponent(project.id)}`}
                  className="group glass-card p-5 flex flex-col gap-3 hover:border-white/15 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/5">
                        <FolderGit2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                          {project.name}
                        </p>
                        {project.language !== 'Unknown' && (
                          <p className="text-[11px] text-text-muted">{project.language}</p>
                        )}
                      </div>
                    </div>
                    <ProjectHealthBadge project={project} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 border-t border-white/5">
                    {project.lastAnalysis ? (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {projectStats
                            ? `${projectStats.openFindings} open finding${projectStats.openFindings !== 1 ? 's' : ''} · ${projectStats.opportunities} opportunit${projectStats.opportunities !== 1 ? 'ies' : 'y'}`
                            : `Analyzed ${new Date(project.lastAnalysis).toLocaleDateString()}`}
                        </span>
                      </span>
                    ) : (
                      <span>Not analyzed yet</span>
                    )}
                    <span className="flex items-center gap-1 font-medium text-text-secondary group-hover:text-text-primary transition-colors shrink-0">
                      Enter
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Row 3: recent activity (real analysis timestamps only) */}
        {recentlyAnalyzed.length > 0 && (
          <div className="glass-card p-5">
            <CardHeader title="Recent Activity" />
            <ul className="space-y-1" aria-label="Recent analyses">
              {recentlyAnalyzed.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/?projectId=${encodeURIComponent(project.id)}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20 shrink-0">
                      <CheckCircle className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-text-secondary group-hover:text-text-primary transition-colors truncate">
                      <span className="font-medium text-text-primary">{project.name}</span> analyzed
                    </span>
                    <span className="text-[11px] text-text-muted tabular-nums shrink-0">
                      {project.lastAnalysis ? new Date(project.lastAnalysis).toLocaleDateString() : ''}
                    </span>
                    <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text-secondary transition-colors shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT SCOPE — focused per-project hub
// ═══════════════════════════════════════════════════════════════════════════

const TABS = ['Overview', 'Executive View'] as const;
type Tab = typeof TABS[number];

function HealthCard({ health, projectId }: { health: HealthMetrics; projectId: string }) {
  return (
    <div className="glass-card p-5 flex flex-col">
      <CardHeader title="Project Health" linkLabel="Details" href={scopedHref('/health', projectId)} />
      {health.analyzed && health.healthScore != null ? (
        <div className="flex items-center gap-5 flex-1">
          <ScoreGauge value={health.healthScore} size={104} label="Health" />
          <div className="min-w-0">
            <p className="text-3xl font-bold tabular-nums text-text-primary">
              {health.healthScore}
              <span className="text-sm text-text-muted font-normal">/100</span>
            </p>
            {health.analyzedAt && (
              <p className="mt-1 text-xs text-text-muted">
                Analyzed {new Date(health.analyzedAt).toLocaleDateString()}
              </p>
            )}
            <div className="mt-2 space-y-1 text-xs text-text-secondary">
              {health.qualityScore != null && (
                <p>Code quality <span className="font-semibold text-text-primary tabular-nums">{health.qualityScore}</span>/100</p>
              )}
              {health.aiQualityScore != null && (
                <p>AI readiness <span className="font-semibold text-text-primary tabular-nums">{health.aiQualityScore}</span>/100</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-start justify-center gap-2">
          <div className="flex items-center gap-2 text-text-secondary">
            <HeartPulse className="h-5 w-5 text-text-muted" aria-hidden="true" />
            <p className="text-sm font-medium">Not analyzed yet</p>
          </div>
          <p className="text-xs text-text-muted">Run an analysis to compute a health score.</p>
          <Link
            href={`/projects/${encodeURIComponent(projectId)}`}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-blue-300 transition-colors"
          >
            <Play className="h-3 w-3" aria-hidden="true" />
            Run analysis
          </Link>
        </div>
      )}
    </div>
  );
}

function SeverityBreakdownCard({
  section,
  projectId,
  onRetry,
}: {
  section: SectionState<FindingsPageData>;
  projectId: string;
  onRetry: () => void;
}) {
  return (
    <div className="glass-card p-5 flex flex-col">
      <CardHeader
        title="Findings by Severity"
        linkLabel="View all"
        href={scopedHref('/findings', projectId)}
      />
      {section.error ? (
        <ErrorBanner message={section.error} onRetry={onRetry} compact />
      ) : !section.data || section.data.stats.total === 0 ? (
        <div className="flex-1 flex flex-col items-start justify-center gap-2">
          <p className="text-sm font-medium text-text-secondary">No findings recorded</p>
          <p className="text-xs text-text-muted">
            Run an analysis to scan for security and quality issues.
          </p>
          <Link
            href={`/projects/${encodeURIComponent(projectId)}`}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-blue-300 transition-colors"
          >
            <Play className="h-3 w-3" aria-hidden="true" />
            Run analysis
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center gap-2">
          {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
            const count = section.data!.stats[severity];
            const pctVal = section.data!.stats.total > 0
              ? Math.round((count / section.data!.stats.total) * 100)
              : 0;
            return (
              <Link
                key={severity}
                href={scopedHref('/findings', projectId)}
                className="group flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.04] transition-colors"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${SEVERITY_DOTS[severity]}`} aria-hidden="true" />
                <span className="text-xs font-medium capitalize text-text-secondary group-hover:text-text-primary transition-colors w-16">
                  {severity}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${SEVERITY_DOTS[severity]}`}
                    style={{ width: `${pctVal}%` }}
                  />
                </div>
                <span className={`text-sm font-bold tabular-nums ${SEVERITY_TEXT[severity]}`}>{count}</span>
              </Link>
            );
          })}
          <p className="mt-1 text-[11px] text-text-muted">
            {section.data.stats.total} finding{section.data.stats.total !== 1 ? 's' : ''} total
          </p>
        </div>
      )}
    </div>
  );
}

function QuickActionsCard({ projectId }: { projectId: string }) {
  const actions = [
    { label: 'Run analysis', description: 'Re-analyze this project', href: `/projects/${encodeURIComponent(projectId)}`, icon: Play, color: 'text-blue-400' },
    { label: 'Review findings', description: 'Security and quality issues', href: scopedHref('/findings', projectId), icon: ShieldAlert, color: 'text-amber-400' },
    { label: 'Review opportunities', description: 'Prioritized improvements', href: scopedHref('/opportunities', projectId), icon: Lightbulb, color: 'text-purple-400' },
    { label: 'Explore system map', description: 'Architecture and dependencies', href: scopedHref('/system-map', projectId), icon: Network, color: 'text-cyan-400' },
  ];

  return (
    <div className="glass-card p-5 flex flex-col">
      <CardHeader title="Quick Actions" />
      <nav className="flex-1 flex flex-col justify-center gap-1.5" aria-label="Quick actions">
        {actions.map(({ label, description, href, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 hover:bg-white/[0.05] border border-transparent hover:border-white/10 transition-all"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/5 shrink-0">
              <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-text-primary">{label}</span>
              <span className="block text-[11px] text-text-muted truncate">{description}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text-secondary transition-colors shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}

function TopFindingsCard({
  section,
  projectId,
  onRetry,
}: {
  section: SectionState<FindingsPageData>;
  projectId: string;
  onRetry: () => void;
}) {
  const openFindings = (section.data?.findings ?? [])
    .filter((f) => f.status === 'open')
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))
    .slice(0, 5);

  return (
    <div className="glass-card p-5">
      <CardHeader
        title="Top Open Findings"
        linkLabel="View all findings"
        href={scopedHref('/findings', projectId)}
      />

      {section.error && <ErrorBanner message={section.error} onRetry={onRetry} compact />}

      {!section.error && openFindings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-text-muted">No open findings.</p>
          <p className="text-xs text-text-muted mt-1">
            {section.data && section.data.stats.total > 0
              ? 'Everything discovered so far has been resolved or suppressed.'
              : 'Run an analysis to scan for issues.'}
          </p>
        </div>
      )}

      {!section.error && openFindings.length > 0 && (
        <ul className="space-y-2" aria-label="Top open findings">
          {openFindings.map((finding) => (
            <li key={finding.id}>
              <Link
                href={scopedHref(`/findings/${encodeURIComponent(finding.id)}`, projectId)}
                className="group flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-3 hover:bg-white/[0.05] hover:border-white/10 transition-all"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${SEVERITY_DOTS[finding.severity] ?? 'bg-amber-400'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                    {finding.title}
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    <span className={`uppercase font-semibold ${SEVERITY_TEXT[finding.severity] ?? 'text-amber-400'}`}>
                      {finding.severity}
                    </span>
                    {' · '}
                    {finding.category}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-text-muted shrink-0 group-hover:text-text-secondary transition-colors" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Executive view widgets (real values only) ──────────────────────────────

function pct(n: number): string {
  return `${Math.round(n)}%`;
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

function KPICard({
  title,
  value,
  icon,
  gradient,
}: {
  title: string;
  value: string;
  icon: string;
  gradient: string;
}) {
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
  opportunity,
  projectId,
}: {
  opportunity: Opportunity;
  projectId: string;
}) {
  const impactColors = { high: '#22c55e', medium: '#eab308', low: '#6b7280' };
  const effortColors = { high: '#ef4444', medium: '#eab308', low: '#22c55e' };
  const impact: 'high' | 'medium' | 'low' =
    opportunity.severity === 'critical' || opportunity.severity === 'high'
      ? 'high'
      : opportunity.severity === 'medium' ? 'medium' : 'low';
  const effort: 'high' | 'medium' | 'low' =
    opportunity.effort > 60 ? 'high' : opportunity.effort > 30 ? 'medium' : 'low';

  return (
    <Link
      href={scopedHref(`/opportunities/${encodeURIComponent(opportunity.id)}`, projectId)}
      className="block rounded-xl p-4 hover:bg-white/[0.03] transition-colors"
      style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
    >
      <h4 className="text-sm font-semibold text-text-primary mb-1">{opportunity.title}</h4>
      <p className="text-xs text-text-secondary mb-3 line-clamp-2">
        {opportunity.description ?? 'No description'}
      </p>
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
    </Link>
  );
}

// ── Project hub ─────────────────────────────────────────────────────────────

function ProjectOverview({ projectId }: { projectId: string }) {
  const { activeProject } = useActiveProject();

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [health, setHealth] = useState<HealthMetrics>(EMPTY_HEALTH_METRICS);
  const [findingsPage, setFindingsPage] = useState<SectionState<FindingsPageData>>({ data: null, error: null });
  const [opportunities, setOpportunities] = useState<SectionState<Opportunity[]>>({ data: null, error: null });
  const [timeline, setTimeline] = useState<SectionState<TimelinePoint[]>>({ data: null, error: null });

  // `getHealthMetrics` throws on a real failure (server down / 5xx) so we can
  // show an error state instead of a misleading "not analyzed" screen. The
  // secondary series degrade per-section: each renders its own ErrorBanner on
  // failure, never a blank panel or a fake zero. All requests are scoped to
  // the active project via the `?projectId=` URL param (apiFetch appends it).
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const h = await getHealthMetrics();
      const [findingsResult, oppsResult, timelineResult] = await Promise.allSettled([
        getFindingsPage(),
        getOpportunities(),
        getTimeline(),
      ]);
      setHealth(h);
      setFindingsPage(settle(findingsResult, 'Failed to load findings'));
      setOpportunities(settle(oppsResult, 'Failed to load opportunities'));
      setTimeline(settle(timelineResult, 'Failed to load the health timeline'));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, projectId]);

  if (loading) {
    return <LoadingSkeleton variant="page" />;
  }

  const projectName = activeProject?.name ?? 'this project';

  if (loadError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Overview"
          subtitle={`Current state of ${projectName} — and what to do next`}
          breadcrumbs={[{ label: 'Workspace', href: '/' }, { label: activeProject?.name ?? 'Project' }]}
        />
        <div className="flex-1 p-6">
          <ErrorBanner
            message={`${loadError} — the analysis server is unreachable or returned an error. This is not the same as having no data yet.`}
            onRetry={() => void load()}
          />
        </div>
      </div>
    );
  }

  const findingsTotal = findingsPage.data?.stats.total ?? 0;
  const oppList = opportunities.data ?? [];
  const timelineData = timeline.data ?? [];

  // Project entered but never analyzed → single clear CTA, not empty widgets.
  const hasAnalysis =
    health.analyzed || findingsTotal > 0 || oppList.length > 0 || timelineData.length > 0;

  if (!hasAnalysis && !findingsPage.error && !opportunities.error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Overview"
          subtitle={`Current state of ${projectName} — and what to do next`}
          breadcrumbs={[{ label: 'Workspace', href: '/' }, { label: activeProject?.name ?? 'Project' }]}
        />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="glass-card max-w-lg w-full">
            <EmptyState
              icon={Play}
              title={`${activeProject?.name ?? 'This project'} hasn't been analyzed yet`}
              description="Run your first analysis to compute a health score and discover findings, opportunities, and the system map."
              action={{ label: 'Open Project & Run Analysis', href: `/projects/${encodeURIComponent(projectId)}` }}
              secondaryAction={{ label: 'Back to workspace', href: '/' }}
            />
          </div>
        </div>
      </div>
    );
  }

  const topOpportunities = [...oppList].sort((a, b) => priorityScore(b) - priorityScore(a));

  // Executive derived metrics — real severity counts only.
  const criticalCount = findingsPage.data?.stats.critical ?? 0;
  const highCount = findingsPage.data?.stats.high ?? 0;
  const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
    criticalCount > 0 ? 'critical'
    : highCount > 5 ? 'high'
    : highCount > 0 ? 'medium'
    : 'low';

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Overview"
        subtitle={`Current state of ${projectName} — and what to do next`}
        breadcrumbs={[{ label: 'Workspace', href: '/' }, { label: activeProject?.name ?? 'Project' }]}
        primaryAction={{
          label: health.analyzed ? 'New Analysis' : 'Run First Analysis',
          href: `/projects/${encodeURIComponent(projectId)}`,
          icon: Play,
        }}
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

        {/* ── Overview (default hub) ─────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <div role="tabpanel" aria-label="Overview" className="space-y-6 stagger-children">
            {/* Row 1: state of the project + what to do next */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <HealthCard health={health} projectId={projectId} />
              <SeverityBreakdownCard
                section={findingsPage}
                projectId={projectId}
                onRetry={() => void load()}
              />
              <QuickActionsCard projectId={projectId} />
            </div>

            {/* Row 2: what needs attention */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TopFindingsCard
                section={findingsPage}
                projectId={projectId}
                onRetry={() => void load()}
              />
              {opportunities.error ? (
                <div className="glass-card p-5">
                  <CardHeader
                    title="Top Opportunities"
                    linkLabel="Explore All Opportunities"
                    href={scopedHref('/opportunities', projectId)}
                  />
                  <ErrorBanner message={opportunities.error} onRetry={() => void load()} compact />
                </div>
              ) : (
                <OpportunitiesList opportunities={topOpportunities} projectId={projectId} />
              )}
            </div>

            {/* Row 3: trend over time (only when there is real history) */}
            {timeline.error ? (
              <ErrorBanner message={timeline.error} onRetry={() => void load()} compact />
            ) : (
              timelineData.length > 0 && <HealthChart data={timelineData} />
            )}
          </div>
        )}

        {/* ── Executive View ─────────────────────────────────────────── */}
        {activeTab === 'Executive View' && (
          <div role="tabpanel" aria-label="Executive View" className="space-y-6 max-w-7xl mx-auto">
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
                value={String(findingsTotal || health.findingCount)}
                icon="🛡️"
                gradient="linear-gradient(135deg, #f97316, #ea580c)"
              />
            </div>

            {/* Risk Assessment + Strategic Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk Panel */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-text-primary mb-4">Risk Assessment</h3>
                {findingsPage.error ? (
                  <ErrorBanner message={findingsPage.error} onRetry={() => void load()} compact />
                ) : (
                  <>
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
                        <p className="text-2xl font-bold text-text-primary">{findingsTotal}</p>
                        <p className="text-[10px] text-text-tertiary uppercase">Total Findings</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-text-primary">{oppList.length}</p>
                        <p className="text-[10px] text-text-tertiary uppercase">Opportunities</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Strategic Recommendations */}
              <div className="lg:col-span-2 glass-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  Strategic Recommendations
                </h3>
                {opportunities.error ? (
                  <ErrorBanner message={opportunities.error} onRetry={() => void load()} compact />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {topOpportunities.length > 0 ? (
                      topOpportunities.slice(0, 4).map((opp) => (
                        <StrategicRecommendation key={opp.id} opportunity={opp} projectId={projectId} />
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-8">
                        <p className="text-sm text-text-secondary">No strategic recommendations available yet.</p>
                        <p className="text-xs text-text-tertiary mt-1">Run an analysis to generate intelligence.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Findings Breakdown */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Findings Severity Distribution</h3>
              {findingsPage.error ? (
                <ErrorBanner message={findingsPage.error} onRetry={() => void load()} compact />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                    const count = findingsPage.data?.stats[severity] ?? 0;
                    const pctVal = findingsTotal > 0 ? (count / findingsTotal) * 100 : 0;
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
              )}
            </div>

            {/* Timeline mini-chart */}
            {timelineData.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-text-primary mb-4">Health Score Trend</h3>
                <div className="flex items-end gap-1 h-20">
                  {timelineData.slice(-30).map((point, i) => {
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
                    {timelineData[timelineData.length - 30]?.date ?? timelineData[0]?.date}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    {timelineData[timelineData.length - 1]?.date}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry — pick scope from the URL (`?projectId=` ⇒ project, else workspace)
// ═══════════════════════════════════════════════════════════════════════════

export default function OverviewPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  if (projectId) {
    return <ProjectOverview key={projectId} projectId={projectId} />;
  }
  return <WorkspaceOverview />;
}
