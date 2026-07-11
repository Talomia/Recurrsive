'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ChevronRight,
  ArrowLeft,
  FolderGit2,
  ExternalLink,
  Play,
  Clock,
  ShieldAlert,
  Lightbulb,
  Settings,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  EyeOff,
} from 'lucide-react';
import Header from '@/components/header';
import ErrorBanner from '@/components/error-banner';
import ScoreGauge from '@/components/score-gauge';
import { apiFetch } from '@/lib/api/client';

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

interface Opportunity {
  id: string;
  title: string;
  severity: string;
  confidence: number;
  effort: number;
  description?: string;
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

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Project>('/api/v1/projects/' + id);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Fetch findings/opportunities when their tabs are activated
  useEffect(() => {
    if (activeTab === 'Findings' && findings.length === 0) {
      apiFetch<Finding[]>(`/api/v1/projects/${id}/findings`)
        .then(setFindings)
        .catch(() => { /* empty state */ });
    }
    if (activeTab === 'Opportunities' && opportunities.length === 0) {
      apiFetch<Opportunity[]>(`/api/v1/projects/${id}/opportunities`)
        .then(setOpportunities)
        .catch(() => { /* empty state */ });
    }
  }, [activeTab, id, findings.length, opportunities.length]);

  const handleAnalyze = async () => {
    if (!project) return;
    setAnalyzing(true);
    try {
      await apiFetch('/api/v1/analysis/trigger', {
        method: 'POST',
        body: JSON.stringify({ repository: project.repository }),
      });
    } catch {
      setError('Failed to start analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  // -- Loading --
  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Project Detail" subtitle="Loading…" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  // -- Error --
  if (error && !project) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Project Detail" />
        <ErrorBanner message={error} onRetry={fetchProject} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Project Detail"
        subtitle={project.name}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <Link
          href="/projects"
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
        <span className="text-text-primary font-medium">{project.name}</span>
      </nav>

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
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-60 shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {project.lastAnalysis ? 'Re-analyze' : 'Analyze'}
          </button>
        </div>
      </div>

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
            {/* Health metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card p-4 text-center">
                <BarChart3 className="h-5 w-5 mx-auto text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-text-primary tabular-nums">{project.healthScore}</p>
                <p className="text-[10px] text-text-muted">Health Score</p>
              </div>
              <div className="glass-card p-4 text-center">
                <ShieldAlert className="h-5 w-5 mx-auto text-amber-400 mb-2" />
                <p className="text-2xl font-bold text-text-primary tabular-nums">{findings.length || '—'}</p>
                <p className="text-[10px] text-text-muted">Findings</p>
              </div>
              <div className="glass-card p-4 text-center">
                <Lightbulb className="h-5 w-5 mx-auto text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-text-primary tabular-nums">{opportunities.length || '—'}</p>
                <p className="text-[10px] text-text-muted">Opportunities</p>
              </div>
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
                          <Link href={`/findings/${f.id}`} className="text-xs font-mono text-accent-blue hover:underline">{f.id}</Link>
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/findings/${f.id}`} className="text-xs font-medium text-text-primary hover:text-accent-blue transition-colors truncate block max-w-xs">{f.title}</Link>
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
                      {opp.description && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{opp.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
                        <span>Confidence: {Math.round(opp.confidence * 100)}%</span>
                        <span>Effort: {opp.effort}h</span>
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
