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
import { scopedHref } from '@/lib/project-links';
import { apiFetch } from '@/lib/api/client';
import Header from '@/components/header';
import { useActiveProject } from '@/components/active-project-context';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import EmptyState from '@/components/ui/empty-state';
import ErrorBanner from '@/components/error-banner';
import LoadingSkeleton from '@/components/loading-skeleton';

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

function ProjectsEmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <EmptyState
        icon={FolderGit2}
        title="No projects yet"
        description="Create your first project to start analyzing your codebase. Recurrsive analyzes your repository for architecture insights, security findings, and improvement opportunities."
        action={{ label: 'Create Your First Project', onClick: onCreateClick, icon: Plus }}
      >
        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5 max-w-xl w-full">
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
      </EmptyState>
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
        href={scopedHref('/findings', project.id)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        Findings
      </Link>
      <Link
        href={scopedHref('/system-map', project.id)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
      >
        <Network className="w-3.5 h-3.5 text-blue-400" />
        System Map
      </Link>
      <Link
        href={scopedHref('/health', project.id)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
      >
        <BarChart3 className="w-3.5 h-3.5 text-green-400" />
        Health
      </Link>
      <Link
        href={scopedHref('/opportunities', project.id)}
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
  const { refresh: refreshActiveProjects } = useActiveProject();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRepo, setNewRepo] = useState('');
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'health' | 'updated'>('updated');
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProjects = useCallback(() => {
    setLoading(true);
    setError(null);
    getProjects()
      .then(setProjects)
      .catch(() => { setError('Failed to load projects. The analysis server may be unreachable.'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = async () => {
    if (!newName.trim() || !newRepo.trim()) return;
    setCreating(true);
    try {
      const data = await apiFetch<Project>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), repository: newRepo.trim() }),
      });
      setProjects(prev => [...prev, data]);
      setNewName('');
      setNewRepo('');
      setShowCreate(false);
      toast(`Project "${data.name}" created. Click "Analyze" to run your first analysis.`, 'success');
      // Keep the global project switcher (sidebar/header) in sync.
      void refreshActiveProjects();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create project.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/projects/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE', unwrap: false });
      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
      toast(`Project "${deleteTarget.name}" deleted.`, 'info');
      setDeleteTarget(null);
      // Keep the global project switcher (sidebar/header) in sync.
      void refreshActiveProjects();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete project.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const analyzeProject = useCallback(async (project: Project) => {
    setAnalyzingIds(prev => new Set(prev).add(project.id));
    try {
      await triggerAnalysis(project.repository, project.id);
      toast(`Analysis started for "${project.name}". Open the project to watch live progress.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : `Failed to start analysis for "${project.name}".`, 'error');
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
    }
  }, [toast]);

  const analyzeAll = useCallback(async () => {
    // Send each project as a { gitUrl, projectId } target so the batch clones
    // the repo and scopes results to the right project. (Sending bare repo URLs
    // as filesystem paths silently failed every item.)
    const targets = projects
      .filter(p => p.repository)
      .map(p => ({ gitUrl: p.repository, projectId: p.id }));
    if (targets.length === 0) {
      toast('No projects have a repository URL to analyze.', 'info');
      return;
    }
    try {
      await createBatchRun({ projects: targets });
      toast(`Batch analysis started for ${targets.length} project${targets.length !== 1 ? 's' : ''}. Check the Batch page for progress.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to start batch analysis.', 'error');
    }
  }, [projects, toast]);

  const sorted = [...projects].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'health') return b.healthScore - a.healthScore;
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });

  const hasAnyAnalyzed = projects.some(p => p.lastAnalysis);

  const headerAction = {
    label: 'New Project',
    onClick: () => setShowCreate((prev) => !prev),
    icon: Plus,
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Header
          title="Projects"
          subtitle="Manage your projects and trigger analyses"
          primaryAction={headerAction}
        />
        <LoadingSkeleton variant="list" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header — the primary journey action lives in the shared shell */}
      <Header
        title="Projects"
        subtitle="Manage your projects and trigger analyses"
        primaryAction={headerAction}
      />
      {projects.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setSortBy(sortBy === 'health' ? 'name' : sortBy === 'name' ? 'updated' : 'health')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortBy === 'health' ? 'By Health' : sortBy === 'name' ? 'By Name' : 'By Updated'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <ErrorBanner message={error} onRetry={loadProjects} onDismiss={() => setError(null)} />
      )}

      {/* Create form */}
      {showCreate && (
        <form
          className="glass-card rounded-2xl p-5"
          onSubmit={(e) => { e.preventDefault(); void createProject(); }}
        >
          <h2 className="text-base font-semibold text-text-primary mb-3">New Project</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Project Name (e.g. My Backend API)"
              aria-label="Project Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              disabled={creating}
              autoFocus
              className="px-3 py-2.5 rounded-lg text-sm disabled:opacity-60"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
            <input
              placeholder="Repository URL (e.g. https://github.com/org/repo)"
              aria-label="Repository URL"
              value={newRepo}
              onChange={e => setNewRepo(e.target.value)}
              disabled={creating}
              className="px-3 py-2.5 rounded-lg text-sm disabled:opacity-60"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              disabled={creating}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim() || !newRepo.trim() || creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.02] disabled:hover:scale-100"
              style={{
                background: newName.trim() && newRepo.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                opacity: newName.trim() && newRepo.trim() && !creating ? 1 : 0.5,
              }}
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
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
        {sorted.length === 0 && !error && <ProjectsEmptyState onCreateClick={() => setShowCreate(true)} />}

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
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-70 ${
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
                    aria-label={`${neverAnalyzed ? 'Analyze' : 'Re-analyze'} ${project.name}`}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="w-4 h-4" aria-hidden="true" />
                    )}
                    {isAnalyzing ? 'Starting…' : neverAnalyzed ? 'Analyze' : 'Re-analyze'}
                  </button>
                  <a
                    href={project.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'var(--color-base)' }}
                    title="Open repository"
                    aria-label={`Open repository for ${project.name} in a new tab`}
                  >
                    <ExternalLink className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                  </a>
                  <Link
                    href={`/projects/${encodeURIComponent(project.id)}`}
                    className="p-2 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'var(--color-base)' }}
                    title="Project settings"
                    aria-label={`Settings for ${project.name}`}
                  >
                    <Settings className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(project)}
                    className="p-2 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'var(--color-base)' }}
                    title="Delete project"
                    aria-label={`Delete ${project.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Quick links to analysis pages — only for analyzed projects */}
              <ProjectQuickLinks project={project} />
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete project"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold text-text-primary">{deleteTarget?.name}</span>? This removes
            the project and its analysis history. This action cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
