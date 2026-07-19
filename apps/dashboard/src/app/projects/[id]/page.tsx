'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  FolderGit2,
  ExternalLink,
  Play,
  Clock,
  ShieldAlert,
  Lightbulb,
  Settings,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  EyeOff,
} from 'lucide-react';
import Header from '@/components/header';
import ErrorBanner from '@/components/error-banner';
import LoadingSkeleton from '@/components/loading-skeleton';
import ScoreGauge from '@/components/score-gauge';
import { apiFetch, ApiError } from '@/lib/api/client';
import { scopedHref } from '@/lib/project-links';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  slug: string;
  repository: string;
  description?: string;
  language: string;
  framework: string;
  healthScore: number;
  lastAnalysis?: string;
  updatedAt?: string;
  settings: {
    analyzers: string[];
    collectors: string[];
    schedule?: string;
    branch?: string;
  };
}

interface Finding {
  id: string;
  title: string;
  severity: string;
  status: string;
  category: string;
  assignee: string;
}

// Raw core Opportunity shape (this route returns the cache objects directly):
// effort is a t-shirt-size object, confidence is 0–1, the problem statement is
// `problem` (there is no `description`).
interface Opportunity {
  id: string;
  title: string;
  severity: string;
  confidence: number;
  effort?: { t_shirt?: string; estimated_hours?: number };
  problem?: string;
  recommendation?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = ['Overview', 'Findings', 'Opportunities', 'Settings'] as const;
type Tab = typeof TABS[number];

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/20' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400', border: 'border-orange-500/20' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-500/20' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400', border: 'border-green-500/20' },
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  open: AlertCircle,
  resolved: CheckCircle2,
  suppressed: EyeOff,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AnalysisStatus {
  phase: 'idle' | 'collecting' | 'parsing' | 'analyzing' | 'reasoning' | 'complete' | 'error';
  progress: number;
  message: string;
  error: string | null;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fetchProject = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<Project>('/api/v1/projects/' + id);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    }
  }, [id]);

  const fetchFindings = useCallback(async () => {
    try {
      const data = await apiFetch<Finding[]>(`/api/v1/projects/${id}/findings`);
      setFindings(data);
    } catch {
      // empty state fallback
    }
  }, [id]);

  const fetchOpportunities = useCallback(async () => {
    try {
      const data = await apiFetch<Opportunity[]>(`/api/v1/projects/${id}/opportunities`);
      setOpportunities(data);
    } catch {
      // empty state fallback
    }
  }, [id]);

  // Poll analysis status when isPolling is true
  useEffect(() => {
    if (!isPolling) return;

    setAnalyzing(true);
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch<AnalysisStatus>('/api/v1/analysis/status');
        setStatus(data);

        if (data.phase === 'complete') {
          clearInterval(interval);
          setIsPolling(false);
          setAnalyzing(false);
          // Refresh statistics, findings, and opportunities automatically
          fetchProject();
          fetchFindings();
          fetchOpportunities();
        } else if (data.phase === 'error') {
          clearInterval(interval);
          setIsPolling(false);
          setAnalyzing(false);
          setError(data.error || 'Analysis failed');
        }
      } catch {
        // network error/timeout during poll, allow retry on next tick
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isPolling, fetchProject, fetchFindings, fetchOpportunities]);

  // Initial project load
  useEffect(() => {
    setLoading(true);
    fetchProject().finally(() => setLoading(false));
  }, [fetchProject]);

  // Check initial analysis status on mount and resume polling if active
  useEffect(() => {
    let active = true;
    apiFetch<AnalysisStatus>('/api/v1/analysis/status')
      .then((data) => {
        if (!active) return;
        setStatus(data);
        if (data && data.phase !== 'idle' && data.phase !== 'complete' && data.phase !== 'error') {
          setIsPolling(true);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Fetch findings/opportunities when their tabs are activated or reset
  useEffect(() => {
    if (activeTab === 'Findings' && findings.length === 0) {
      fetchFindings();
    }
    if (activeTab === 'Opportunities' && opportunities.length === 0) {
      fetchOpportunities();
    }
  }, [activeTab, fetchFindings, fetchOpportunities, findings.length, opportunities.length]);

  const handleAnalyze = async () => {
    if (!project) return;
    setAnalyzing(true);
    setError(null);
    try {
      const isGitUrl = project.repository.includes('github.com') || project.repository.startsWith('git@') || project.repository.startsWith('http');
      // Scope the analysis to THIS project so its results (cache, history, and
      // health write-back) land under this project's id — where this page reads.
      const body = isGitUrl
        ? { gitUrl: project.repository, include_reasoning: true, projectId: project.id }
        : { path: project.repository, include_reasoning: true, projectId: project.id };

      await apiFetch('/api/v1/analyze', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // Clear existing client lists to show fresh tracking
      setFindings([]);
      setOpportunities([]);

      setIsPolling(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already running! Gracefully start polling instead of failing.
        setIsPolling(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start analysis.');
        setAnalyzing(false);
      }
    }
  };


  // -- Loading --
  if (loading) {
    return <LoadingSkeleton variant="page" />;
  }

  // -- Error --
  if (error && !project) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header
          title="Project Detail"
          breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Project' }]}
        />
        <ErrorBanner message={error} onRetry={fetchProject} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title={project.name}
        subtitle={project.description ?? project.repository}
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: project.name }]}
        primaryAction={{
          label: analyzing ? 'Analyzing…' : project.lastAnalysis ? 'Re-analyze' : 'Analyze',
          onClick: () => void handleAnalyze(),
          icon: Play,
          disabled: analyzing,
        }}
      />

      {/* Error banner */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Project header card */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <ScoreGauge value={project.healthScore} size={100} label="Health" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <FolderGit2 className="h-5 w-5 text-blue-400 shrink-0" />
              <h2 className="text-xl font-bold text-text-primary truncate">{project.name}</h2>
            </div>
            {project.description && (
              <p className="text-sm text-text-secondary mt-1">{project.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-text-muted">
              {project.language !== 'Unknown' && (
                <span className="rounded bg-blue-500/20 text-blue-400 px-2 py-0.5 font-medium">{project.language}</span>
              )}
              {project.framework !== 'Unknown' && (
                <span>{project.framework}</span>
              )}
              <a
                href={project.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Repository
              </a>
              {project.lastAnalysis && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last analyzed: {new Date(project.lastAnalysis).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {project.lastAnalysis && (
            <Link
              href={`/?projectId=${encodeURIComponent(project.id)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors shrink-0"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Open Overview
            </Link>
          )}
        </div>
      </div>

      {/* Real-time Analysis Progress Section */}
      {analyzing && status && (
        <div className="glass-card p-6 border border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl relative overflow-hidden shadow-lg shadow-blue-500/5">
          {/* Background glow effects */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                <h3 className="text-xs font-bold text-text-primary tracking-wide uppercase">AI Agents Analysis in Progress</h3>
              </div>
              <span className="text-xs font-mono font-semibold text-blue-400 tabular-nums">{status.progress}%</span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/5 relative">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>

            {/* Phase Description and Status Message */}
            <div className="flex flex-col gap-1.5 bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping animate-pulse-subtle" />
                {status.message}
              </p>
              <p className="text-xs text-text-muted">
                {status.phase === 'collecting' && 'Fetching files, commit history, and environment configurations...'}
                {status.phase === 'parsing' && 'Scanning source code, constructing ASTs, and resolving internal references...'}
                {status.phase === 'analyzing' && 'Running specialist collectors for architecture, AI integrations, security, cost, and resilience...'}
                {status.phase === 'reasoning' && 'Multi-agent consensus protocol active. Specialist AI agents are currently debating hypotheses to synthesize findings...'}
              </p>
            </div>

            {/* Stepper Visualization */}
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] mt-1">
              {[
                { phase: 'collecting', label: '1. Collect' },
                { phase: 'parsing', label: '2. Parse' },
                { phase: 'analyzing', label: '3. Analyze' },
                { phase: 'reasoning', label: '4. Reason' },
              ].map((step, idx) => {
                const phases = ['collecting', 'parsing', 'analyzing', 'reasoning', 'complete'];
                const activeIdx = phases.indexOf(status.phase);
                const isCompleted = activeIdx > idx;
                const isActive = status.phase === step.phase;

                return (
                  <div
                    key={step.phase}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all border ${
                      isActive
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold'
                        : isCompleted
                        ? 'bg-green-500/5 border-green-500/10 text-green-400'
                        : 'bg-white/5 border-white/5 text-text-muted'
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isActive
                          ? 'bg-blue-400 text-slate-950'
                          : isCompleted
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/5 text-text-muted'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex items-center gap-1 border-b border-white/10"
        role="tablist"
        aria-label="Project sections"
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
      <div role="tabpanel" aria-label={activeTab}>
        {/* Overview */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            {/* Health metrics — each tile is a one-click path into the journey */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link href={scopedHref('/health', project.id)} className="glass-card p-4 text-center hover:border-white/15 transition-all">
                <BarChart3 className="h-5 w-5 mx-auto text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-text-primary tabular-nums">{project.healthScore}</p>
                <p className="text-[10px] text-text-muted">Health Score</p>
              </Link>
              <Link href={scopedHref('/findings', project.id)} className="glass-card p-4 text-center hover:border-white/15 transition-all">
                <ShieldAlert className="h-5 w-5 mx-auto text-amber-400 mb-2" />
                <p className="text-2xl font-bold text-text-primary tabular-nums">{findings.length || '—'}</p>
                <p className="text-[10px] text-text-muted">Findings</p>
              </Link>
              <Link href={scopedHref('/opportunities', project.id)} className="glass-card p-4 text-center hover:border-white/15 transition-all">
                <Lightbulb className="h-5 w-5 mx-auto text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-text-primary tabular-nums">{opportunities.length || '—'}</p>
                <p className="text-[10px] text-text-muted">Opportunities</p>
              </Link>
              <div className="glass-card p-4 text-center">
                <Settings className="h-5 w-5 mx-auto text-cyan-400 mb-2" />
                <p className="text-2xl font-bold text-text-primary tabular-nums">{project.settings.analyzers.length}</p>
                <p className="text-[10px] text-text-muted">Analyzers</p>
              </div>
            </div>

            {/* Recent analysis info */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Analyzers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {project.settings.analyzers.map((a) => (
                      <span key={a} className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs text-blue-400">{a}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Collectors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {project.settings.collectors.map((c) => (
                      <span key={c} className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs text-purple-400">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Findings */}
        {activeTab === 'Findings' && (
          <div className="glass-card overflow-hidden">
            {findings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <ShieldAlert className="h-8 w-8 text-text-muted mb-3" />
                <h3 className="text-sm font-semibold text-text-primary mb-1">No findings</h3>
                <p className="text-xs text-text-secondary">Run an analysis to discover security findings for this project.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">ID</th>
                    <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">Title</th>
                    <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">Severity</th>
                    <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => {
                    const s = SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.medium!;
                    const StatusIcon = STATUS_ICONS[f.status] ?? AlertCircle;
                    return (
                      <tr key={f.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <Link href={scopedHref(`/findings/${encodeURIComponent(f.id)}`, project.id)} className="text-xs font-mono text-accent-blue hover:underline">{f.id}</Link>
                        </td>
                        <td className="px-5 py-3">
                          <Link href={scopedHref(`/findings/${encodeURIComponent(f.id)}`, project.id)} className="text-xs font-medium text-text-primary hover:text-accent-blue transition-colors truncate block max-w-xs">{f.title}</Link>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${s.bg} ${s.text} border ${s.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {f.severity}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                            <StatusIcon className="h-3 w-3" />
                            {f.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Opportunities */}
        {activeTab === 'Opportunities' && (
          <div className="space-y-3">
            {opportunities.length === 0 ? (
              <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
                <Lightbulb className="h-8 w-8 text-text-muted mb-3" />
                <h3 className="text-sm font-semibold text-text-primary mb-1">No opportunities</h3>
                <p className="text-xs text-text-secondary">Run an analysis to discover improvement opportunities.</p>
              </div>
            ) : (
              opportunities.map((opp) => {
                const s = SEVERITY_STYLES[opp.severity] ?? SEVERITY_STYLES.medium!;
                return (
                  <div key={opp.id} className="glass-card p-4 flex items-start gap-4">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1.5 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary">{opp.title}</h4>
                      {(opp.problem || opp.recommendation) && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{opp.problem || opp.recommendation}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
                        {typeof opp.confidence === 'number' && (
                          <span>Confidence: {Math.round(opp.confidence * 100)}%</span>
                        )}
                        {opp.effort?.t_shirt && (
                          <span>Effort: {opp.effort.t_shirt.toUpperCase()}
                            {opp.effort.estimated_hours != null ? ` (~${opp.effort.estimated_hours}h)` : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Settings */}
        {activeTab === 'Settings' && (
          <div className="glass-card p-5 space-y-5">
            <h3 className="text-sm font-semibold text-text-primary">Project Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-2">Repository URL</label>
                <input
                  type="text"
                  value={project.repository}
                  readOnly
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-2">Branch</label>
                <input
                  type="text"
                  value={project.settings.branch ?? 'main'}
                  readOnly
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-2">Schedule</label>
                <input
                  type="text"
                  value={project.settings.schedule ?? 'Manual'}
                  readOnly
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-2">Language</label>
                <input
                  type="text"
                  value={project.language}
                  readOnly
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-2">Active Analyzers</label>
              <div className="flex flex-wrap gap-2">
                {project.settings.analyzers.map((a) => (
                  <span key={a} className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs text-blue-400 font-medium">{a}</span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-2">Active Collectors</label>
              <div className="flex flex-wrap gap-2">
                {project.settings.collectors.map((c) => (
                  <span key={c} className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-xs text-purple-400 font-medium">{c}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
