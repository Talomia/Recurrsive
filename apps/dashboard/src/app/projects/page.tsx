'use client';
/**
 * Multi-project management page.
 *
 * Lists all projects, shows health comparison, and allows project CRUD.
 * Guides users through the analysis workflow with clear next-step CTAs.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  Plus,
  ArrowUpDown,
  ExternalLink,
  Settings,
  Trash2,
  Loader2,
  Play,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Rocket,
  ShieldAlert,
  Network,
  BarChart3,
  Clock,
} from 'lucide-react';
import { getProjects, createBatchRun, triggerAnalysis } from '@/lib/api';
import type { Project } from '@/lib/api';
import { apiFetch } from '@/lib/api/client';
import Header from '@/components/header';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HealthBadge({ score, analyzed }: { score: number; analyzed: boolean }) {
  if (!analyzed) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-white/5 text-text-muted border-white/10">
        Not analyzed
      </span>
    );
  }

  const color = score >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : score >= 60 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${color}`}>
      {score}
    </span>
  );
}

function LanguageBadge({ language }: { language: string }) {
  if (language === 'Unknown') return null;
  const colors: Record<string, string> = {
    TypeScript: 'bg-blue-500/20 text-blue-400',
    Python: 'bg-yellow-500/20 text-yellow-400',
    Go: 'bg-cyan-500/20 text-cyan-400',
    Rust: 'bg-orange-500/20 text-orange-400',
    Java: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[language] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {language}
    </span>
  );
}

/** Success/info toast banner */
function Toast({ message, type = 'success', onDismiss }: { message: string; type?: 'success' | 'info' | 'error'; onDismiss: () => void }) {
  const colors = {
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
  };

  return (
    <div className={`rounded-xl p-4 text-sm flex items-center justify-between border ${colors[type]} animate-fade-in`}>
      <div className="flex items-center gap-2">
        {type === 'success' && <CheckCircle2 className="w-4 h-4" />}
        {type === 'info' && <Sparkles className="w-4 h-4" />}
        <span>{message}</span>
      </div>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity ml-4">✕</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Getting Started Guide — shown when projects exist but none analyzed
// ---------------------------------------------------------------------------

function GettingStartedGuide({ projectCount, onAnalyzeAll }: { projectCount: number; onAnalyzeAll: () => void }) {
  return (
    <div
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.08))',
        border: '1px solid rgba(99, 102, 241, 0.15)',
      }}
    >
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4), transparent 70%)' }} />

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Get Started with Recurrsive</h3>
            <p className="text-xs text-text-secondary">Run your first analysis to unlock engineering intelligence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Step 1 — Done */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/20 shrink-0 mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Create a project</p>
              <p className="text-xs text-text-secondary mt-0.5">You have {projectCount} project{projectCount !== 1 ? 's' : ''} registered</p>
            </div>
          </div>

          {/* Step 2 — Current */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/15">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-400">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-300">Run analysis</p>
              <p className="text-xs text-text-secondary mt-0.5">Click &quot;Analyze&quot; on a project or analyze all below</p>
            </div>
          </div>

          {/* Step 3 — Future */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] opacity-60">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 shrink-0 mt-0.5">
              <span className="text-xs font-bold text-text-muted">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Explore results</p>
              <p className="text-xs text-text-secondary mt-0.5">View findings, health scores, and system maps</p>
            </div>
          </div>
        </div>

        <button
          onClick={onAnalyzeAll}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          <Play className="w-4 h-4" />
          Analyze All Projects
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — shown when no projects exist
// ---------------------------------------------------------------------------

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
        style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))' }}>
        <FolderGit2 className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="text-lg font-bold text-text-primary mb-2">No projects yet</h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
        Create your first project to start analyzing your codebase. Recurrsive will scan your repository for
        architecture insights, security findings, and improvement opportunities.
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
      >
        <Plus className="w-4 h-4" />
        Create Your First Project
      </button>

      <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5">
        <div className="text-center">
          <ShieldAlert className="w-5 h-5 mx-auto mb-2 text-amber-400" />
          <p className="text-xs font-medium text-text-primary">Security Findings</p>
          <p className="text-[10px] text-text-muted mt-0.5">Detect vulnerabilities</p>
        </div>
        <div className="text-center">
          <Network className="w-5 h-5 mx-auto mb-2 text-blue-400" />
          <p className="text-xs font-medium text-text-primary">System Map</p>
          <p className="text-[10px] text-text-muted mt-0.5">Visualize architecture</p>
        </div>
        <div className="text-center">
          <BarChart3 className="w-5 h-5 mx-auto mb-2 text-green-400" />
          <p className="text-xs font-medium text-text-primary">Health Score</p>
          <p className="text-[10px] text-text-muted mt-0.5">Track quality over time</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick links row — shown on project cards for analyzed projects
// ---------------------------------------------------------------------------

function ProjectQuickLinks({ project }: { project: Project }) {
  if (!project.lastAnalysis) return null;

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
      <Link
        href="/findings"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        Findings
      </Link>
      <Link
        href="/system-map"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
      >
        <Network className="w-3.5 h-3.5 text-blue-400" />
        System Map
      </Link>
      <Link
        href="/health"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
      >
        <BarChart3 className="w-3.5 h-3.5 text-green-400" />
        Health
      </Link>
      <Link
        href="/opportunities"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        Opportunities
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRepo, setNewRepo] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'health' | 'updated'>('updated');
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch(() => { setError('Failed to load projects.'); })
      .finally(() => setLoading(false));
  }, []);

  // Auto-dismiss toast after 5s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const createProject = async () => {
    if (!newName || !newRepo) return;
    try {
      const data = await apiFetch<Project>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newName, repository: newRepo }),
      });
      setProjects(prev => [...prev, data]);
      setNewName('');
      setNewRepo('');
      setShowCreate(false);
      setToast({ message: `Project "${data.name}" created! Click "Analyze" to run your first analysis.`, type: 'success' });
    } catch {
      setError('Failed to create project.');
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await apiFetch(`/api/v1/projects/${encodeURIComponent(id)}`, { method: 'DELETE', unwrap: false });
      setProjects(prev => prev.filter(p => p.id !== id));
      setToast({ message: 'Project deleted.', type: 'info' });
    } catch {
      setError('Failed to delete project.');
    }
  };

  const analyzeProject = useCallback(async (project: Project) => {
    setAnalyzingIds(prev => new Set(prev).add(project.id));
    try {
      await triggerAnalysis(project.id);
      setToast({ message: `Analysis started for "${project.name}". Check the Overview page for progress.`, type: 'success' });
    } catch {
      setToast({ message: `Failed to start analysis for "${project.name}".`, type: 'error' });
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
    }
  }, []);

  const analyzeAll = useCallback(async () => {
    const projectIds = projects.map(p => p.id);
    if (projectIds.length === 0) return;
    try {
      await createBatchRun({ projectIds });
      setToast({ message: `Batch analysis started for ${projectIds.length} project${projectIds.length !== 1 ? 's' : ''}. Check the Batch page for progress.`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to start batch analysis.', type: 'error' });
    }
  }, [projects]);

  const sorted = [...projects].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'health') return b.healthScore - a.healthScore;
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });

  const hasAnyAnalyzed = projects.some(p => p.lastAnalysis);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Header title="Projects" subtitle="Manage your registered repositories and trigger analyses" />
      <div className="flex items-center justify-end gap-3">
          {projects.length > 0 && (
            <button
              onClick={() => setSortBy(sortBy === 'health' ? 'name' : sortBy === 'name' ? 'updated' : 'health')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortBy === 'health' ? 'By Health' : sortBy === 'name' ? 'By Name' : 'By Updated'}
            </button>
          )}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.02]"
            style={{ background: 'var(--color-accent)' }}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-3">Create New Project</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Project Name (e.g. My Backend API)"
              aria-label="Project Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
            <input
              placeholder="Repository URL (e.g. https://github.com/org/repo)"
              aria-label="Repository URL"
              value={newRepo}
              onChange={e => setNewRepo(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
            <button
              onClick={createProject}
              disabled={!newName || !newRepo}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.02]"
              style={{ background: newName && newRepo ? 'var(--color-accent)' : 'var(--color-border)', opacity: newName && newRepo ? 1 : 0.5 }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Getting Started Guide — shown when projects exist but none analyzed */}
      {projects.length > 0 && !hasAnyAnalyzed && (
        <GettingStartedGuide projectCount={projects.length} onAnalyzeAll={analyzeAll} />
      )}

      {/* Health Overview — only show when we have analyzed projects */}
      {hasAnyAnalyzed && sorted.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-3">Health Overview</h2>
          <div className="flex items-end gap-1 h-28">
            {sorted.map(p => (
              <div key={p.id} className="flex-1 flex flex-col items-center group cursor-pointer">
                <div
                  className="w-full rounded-t transition-all group-hover:opacity-80"
                  style={{
                    height: `${Math.max(8, (p.healthScore / 100) * 112)}px`,
                    background: !p.lastAnalysis ? 'rgba(148, 163, 184, 0.2)'
                      : p.healthScore >= 80 ? 'rgba(34, 197, 94, 0.6)'
                      : p.healthScore >= 60 ? 'rgba(234, 179, 8, 0.6)' : 'rgba(239, 68, 68, 0.6)',
                    minWidth: '24px',
                  }}
                />
                <span className="text-[10px] text-text-tertiary mt-1 truncate max-w-[60px]">{p.slug}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project List */}
      <div className="space-y-3">
        {sorted.length === 0 && <EmptyState onCreateClick={() => setShowCreate(true)} />}

        {sorted.map(project => {
          const isAnalyzing = analyzingIds.has(project.id);
          const neverAnalyzed = !project.lastAnalysis;

          return (
            <div
              key={project.id}
              className="rounded-2xl p-5 transition-all hover:border-white/15"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
                    <HealthBadge score={project.healthScore} analyzed={!neverAnalyzed} />
                    <LanguageBadge language={project.language} />
                  </div>
                  {project.description && (
                    <p className="text-sm text-text-secondary mt-1">{project.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
                    {project.framework !== 'Unknown' && (
                      <>
                        <span>{project.framework}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{project.settings.analyzers.length} analyzers</span>
                    <span>•</span>
                    <span>{project.settings.collectors.length} collectors</span>
                    {project.lastAnalysis && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last analyzed: {new Date(project.lastAnalysis).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Analyze button — prominent for never-analyzed projects */}
                  <button
                    onClick={() => analyzeProject(project)}
                    disabled={isAnalyzing}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] ${
                      neverAnalyzed
                        ? 'text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                    style={{
                      background: neverAnalyzed
                        ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                        : 'var(--color-base)',
                    }}
                    title="Run analysis"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {neverAnalyzed ? 'Analyze' : 'Re-analyze'}
                  </button>
                  <a
                    href={project.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'var(--color-base)' }}
                    title="Open repository"
                  >
                    <ExternalLink className="w-4 h-4 text-text-tertiary" />
                  </a>
                  <button className="p-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }} title="Settings">
                    <Settings className="w-4 h-4 text-text-tertiary" />
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-2 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'var(--color-base)' }}
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Quick links to analysis pages — only for analyzed projects */}
              <ProjectQuickLinks project={project} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
