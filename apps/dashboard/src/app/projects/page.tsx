'use client';

/**
 * Multi-project management page.
 *
 * Lists all projects, shows health comparison, and allows project CRUD.
 */

import { useState, useEffect } from 'react';
import { FolderGit2, Plus, ArrowUpDown, ExternalLink, Settings, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { getProjects } from '@/lib/api';
import type { Project } from '@/lib/api';

function HealthBadge({ score }: { score: number }) {
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRepo, setNewRepo] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'health' | 'updated'>('health');

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const createProject = async () => {
    if (!newName || !newRepo) return;
    const res = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, repository: newRepo }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setProjects(prev => [...prev, data]);
      setNewName('');
      setNewRepo('');
      setShowCreate(false);
    }
  };

  const deleteProject = async (id: string) => {
    await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const sorted = [...projects].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'health') return b.healthScore - a.healthScore;
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FolderGit2 className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            Projects
          </h1>
          <p className="text-sm text-text-secondary mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''} managed</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortBy(sortBy === 'health' ? 'name' : sortBy === 'name' ? 'updated' : 'health')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortBy === 'health' ? 'By Health' : sortBy === 'name' ? 'By Name' : 'By Updated'}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: 'var(--color-accent)' }}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-base font-semibold text-text-primary mb-3">Create New Project</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Project Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
            <input
              placeholder="Repository URL"
              value={newRepo}
              onChange={e => setNewRepo(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button
              onClick={createProject}
              disabled={!newName || !newRepo}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: newName && newRepo ? 'var(--color-accent)' : 'var(--color-border)', opacity: newName && newRepo ? 1 : 0.5 }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Health Overview */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3">Health Overview</h3>
        <div className="flex items-end gap-1 h-28">
          {sorted.map(p => (
            <div key={p.id} className="flex-1 flex flex-col items-center group cursor-pointer">
              <div
                className="w-full rounded-t transition-all group-hover:opacity-80"
                style={{
                  height: `${Math.max(8, (p.healthScore / 100) * 112)}px`,
                  background: p.healthScore >= 80 ? 'rgba(34, 197, 94, 0.6)' :
                    p.healthScore >= 60 ? 'rgba(234, 179, 8, 0.6)' : 'rgba(239, 68, 68, 0.6)',
                  minWidth: '24px',
                }}
              />
              <span className="text-[10px] text-text-tertiary mt-1 truncate max-w-[60px]">{p.slug}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Project List */}
      <div className="space-y-3">
        {sorted.map(project => (
          <div
            key={project.id}
            className="rounded-2xl p-5 transition-all hover:scale-[1.005]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-text-primary">{project.name}</h3>
                  <HealthBadge score={project.healthScore} />
                  <LanguageBadge language={project.language} />
                </div>
                <p className="text-sm text-text-secondary mt-1">{project.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
                  <span>{project.framework}</span>
                  <span>•</span>
                  <span>{project.settings.analyzers.length} analyzers</span>
                  <span>•</span>
                  <span>{project.settings.collectors.length} collectors</span>
                  {project.lastAnalysis && (
                    <>
                      <span>•</span>
                      <span>Last analyzed: {new Date(project.lastAnalysis).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={project.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg transition-all hover:opacity-80"
                  style={{ background: 'var(--color-base)' }}
                >
                  <ExternalLink className="w-4 h-4 text-text-tertiary" />
                </a>
                <button className="p-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }}>
                  <Settings className="w-4 h-4 text-text-tertiary" />
                </button>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="p-2 rounded-lg transition-all hover:opacity-80"
                  style={{ background: 'var(--color-base)' }}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
                <ChevronRight className="w-4 h-4 text-text-tertiary ml-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
