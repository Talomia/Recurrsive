'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertTriangle, FlaskConical, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import Header from '@/components/header';
import { useActiveProject } from '@/components/active-project-context';
import { useAuth } from '@/lib/auth-context';
import { createExperiment, deleteExperiment, getExperiments, runExperiment, type DashboardExperiment } from '@/lib/api';

function statusClass(status: DashboardExperiment['status']): string {
  if (status === 'completed') return 'bg-green-500/10 text-green-400';
  if (status === 'running') return 'bg-blue-500/10 text-blue-400';
  if (status === 'failed') return 'bg-red-500/10 text-red-400';
  return 'bg-white/5 text-text-muted';
}

export default function ExperimentsPage() {
  const { activeProject } = useActiveProject();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'analyst';
  const [experiments, setExperiments] = useState<DashboardExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [variantName, setVariantName] = useState('Candidate');
  const [candidateAnalyzers, setCandidateAnalyzers] = useState<string[]>(activeProject?.settings.analyzers ?? []);
  const [candidateReasoning, setCandidateReasoning] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeProject) return;
    setExperiments(await getExperiments());
  }, [activeProject]);

  useEffect(() => {
    refresh().catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load experiments.')).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!experiments.some((experiment) => experiment.status === 'running')) return;
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 3_000);
    return () => window.clearInterval(timer);
  }, [experiments, refresh]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!activeProject) return;
    setSaving(true);
    setError(null);
    try {
      await createExperiment({
        name,
        hypothesis,
        variants: [
          { name: 'Baseline', analyzers: activeProject.settings.analyzers, collectors: activeProject.settings.collectors, includeReasoning: true },
          { name: variantName, analyzers: candidateAnalyzers, collectors: activeProject.settings.collectors, includeReasoning: candidateReasoning },
        ],
      });
      setShowCreate(false);
      setName('');
      setHypothesis('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create experiment.');
    } finally {
      setSaving(false);
    }
  }

  async function mutate(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Experiment operation failed.'); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-accent-blue" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><Header title="Analysis experiments" subtitle={`Compare analyzer configurations on ${activeProject?.name ?? 'the selected project'} in isolated runs`} />{canManage && <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />New experiment</button>}</div>
      {error && <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertTriangle className="h-4 w-4" />{error}</div>}

      {showCreate && activeProject && (
        <form onSubmit={create} className="glass-card space-y-5 rounded-2xl p-5">
          <div><h2 className="font-semibold">Configure experiment</h2><p className="mt-1 text-xs text-text-muted">Baseline uses the project’s full configuration. Candidate runs in a separate graph and does not replace project results.</p></div>
          <div className="grid gap-4 md:grid-cols-2"><label className="text-sm text-text-secondary">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" /></label><label className="text-sm text-text-secondary">Candidate name<input required value={variantName} onChange={(event) => setVariantName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" /></label><label className="text-sm text-text-secondary md:col-span-2">Hypothesis<textarea required value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" /></label></div>
          <fieldset><legend className="mb-2 text-sm text-text-secondary">Candidate analyzers</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{activeProject.settings.analyzers.map((analyzer) => <label key={analyzer} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-text-secondary"><input type="checkbox" checked={candidateAnalyzers.includes(analyzer)} onChange={(event) => setCandidateAnalyzers((current) => event.target.checked ? [...current, analyzer] : current.filter((id) => id !== analyzer))} />{analyzer}</label>)}</div></fieldset>
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={candidateReasoning} onChange={(event) => setCandidateReasoning(event.target.checked)} />Include reasoning in candidate run</label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-secondary">Cancel</button><button disabled={saving || candidateAnalyzers.length === 0} className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create experiment'}</button></div>
        </form>
      )}

      {experiments.length === 0 ? <div className="glass-card rounded-2xl p-12 text-center"><FlaskConical className="mx-auto mb-3 h-9 w-9 text-text-muted" /><h2 className="font-medium">No experiments yet</h2><p className="mt-1 text-sm text-text-muted">Create an isolated two-variant analysis comparison.</p></div> : (
        <div className="grid gap-4 lg:grid-cols-2">{experiments.map((experiment) => (
          <article key={experiment.id} className="glass-card rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3"><div><Link href={`/experiments/${encodeURIComponent(experiment.id)}?projectId=${encodeURIComponent(experiment.projectId)}`} className="font-semibold text-text-primary hover:text-blue-400">{experiment.name}</Link><p className="mt-1 text-xs text-text-secondary">{experiment.hypothesis}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${statusClass(experiment.status)}`}>{experiment.status}</span></div>
            <div className="mt-4 flex flex-wrap gap-2">{experiment.variants.map((variant) => <span key={variant.name} className="rounded bg-white/5 px-2 py-1 text-xs text-text-secondary">{variant.name}: {variant.analyzers.length} analyzers</span>)}</div>
            {experiment.metrics.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2">{experiment.metrics.slice(0, 4).map((metric) => <div key={metric.name} className="rounded-lg bg-white/[0.02] p-2 text-xs"><span className="block text-text-muted">{metric.name.replaceAll('_', ' ')}</span><span className="text-text-primary">{metric.variant_a} → {metric.variant_b}</span><span className="ml-2 text-text-muted">({metric.preferred === 'tie' ? 'tie' : `${metric.preferred.toUpperCase()} preferred`})</span></div>)}</div>}
            {experiment.error && <p className="mt-3 text-xs text-red-400">{experiment.error}</p>}
            {canManage && <div className="mt-4 flex justify-end gap-2">{experiment.status !== 'running' && <button type="button" onClick={() => void mutate(() => runExperiment(experiment.id))} className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400"><Play className="h-3.5 w-3.5" />{experiment.status === 'pending' ? 'Run' : 'Run again'}</button>} {experiment.status !== 'running' && <button type="button" onClick={() => { if (window.confirm(`Delete experiment “${experiment.name}”?`)) void mutate(() => deleteExperiment(experiment.id)); }} className="rounded-lg bg-red-500/10 p-2 text-red-400" aria-label={`Delete ${experiment.name}`}><Trash2 className="h-3.5 w-3.5" /></button>}</div>}
          </article>
        ))}</div>
      )}
    </div>
  );
}
