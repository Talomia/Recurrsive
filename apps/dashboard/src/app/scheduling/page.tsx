'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Clock, Download, FileText, Pause, Play, Trash2, Zap } from 'lucide-react';
import Header from '@/components/header';
import { useActiveProject } from '@/components/active-project-context';
import { useAuth } from '@/lib/auth-context';
import {
  createSchedule,
  deleteSchedule,
  getScheduleHistory,
  getSchedules,
  runScheduleNow,
  toggleSchedule as toggleScheduleApi,
  type ReportSchedule,
  type ScheduleRunHistory,
} from '@/lib/api';

const FORMATS: ReportSchedule['format'][] = ['markdown', 'html', 'json', 'sarif'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClass(status: string): string {
  if (status === 'active' || status === 'completed') return 'bg-green-500/15 text-green-400';
  if (status === 'failed' || status === 'error') return 'bg-red-500/15 text-red-400';
  if (status === 'generating' || status === 'queued') return 'bg-blue-500/15 text-blue-400';
  return 'bg-yellow-500/15 text-yellow-400';
}

function countdown(target: string): string {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return days ? `in ${days}d ${hours}h` : hours ? `in ${hours}h ${minutes}m` : `in ${minutes}m`;
}

export default function SchedulingPage() {
  const { activeProject } = useActiveProject();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'analyst';
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [history, setHistory] = useState<ScheduleRunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [cron, setCron] = useState('0 9 * * 1');
  const [timezone, setTimezone] = useState('UTC');
  const [format, setFormat] = useState<ReportSchedule['format']>('markdown');
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeProject) return;
    const [nextSchedules, nextHistory] = await Promise.all([getSchedules(), getScheduleHistory()]);
    setSchedules(nextSchedules);
    setHistory(nextHistory);
  }, [activeProject]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    refresh()
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load schedules'))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function mutate(action: () => Promise<unknown>) {
    setMutating(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The schedule operation failed');
    } finally {
      setMutating(false);
    }
  }

  async function handleCreate() {
    await mutate(() => createSchedule({ name, cron, timezone, format }));
    setShowCreate(false);
    setName('');
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-text-secondary" role="status">Loading schedules…</div>;
  }

  return (
    <div className="space-y-6 px-4 pb-6 sm:px-6 lg:p-6">
      <Header title="Report scheduling" subtitle={`Automated reports for ${activeProject?.name ?? 'the selected project'}`} />

      {canEdit && <div className="flex justify-end">
        <button type="button" onClick={() => setShowCreate((visible) => !visible)} className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white">
          <Calendar className="h-4 w-4" aria-hidden="true" /> New schedule
        </button>
      </div>}

      {error && <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

      {showCreate && (
        <form onSubmit={(event) => { event.preventDefault(); void handleCreate(); }} className="glass-card space-y-4 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary">Create report schedule</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-text-secondary">Name
              <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" />
            </label>
            <label className="text-sm text-text-secondary">Report format
              <select value={format} onChange={(event) => setFormat(event.target.value as ReportSchedule['format'])} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary">
                {FORMATS.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
              </select>
            </label>
            <label className="text-sm text-text-secondary">Cron expression
              <input required value={cron} onChange={(event) => setCron(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 font-mono text-text-primary" aria-describedby="cron-help" />
              <span id="cron-help" className="mt-1 block text-xs text-text-muted">Five fields: minute, hour, day, month, weekday.</span>
            </label>
            <label className="text-sm text-text-secondary">IANA timezone
              <input required value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="UTC" className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm text-text-secondary">Cancel</button>
            <button disabled={mutating} className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{mutating ? 'Creating…' : 'Create schedule'}</button>
          </div>
        </form>
      )}

      <section aria-labelledby="schedules-title" className="space-y-3">
        <h2 id="schedules-title" className="text-base font-semibold text-text-primary">Schedules</h2>
        {schedules.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-sm text-text-secondary">No report schedules for this project.</div>
        ) : schedules.map((schedule) => (
          <article key={schedule.id} className="glass-card rounded-2xl p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  <h3 className="font-semibold text-text-primary">{schedule.name}</h3>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(schedule.status)}`}>{schedule.status}</span>
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs uppercase text-text-secondary">{schedule.format}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" /><code>{schedule.cron}</code> ({schedule.timezone})</span>
                  <span>Next run {countdown(schedule.nextRunAt)}</span>
                  <span>{schedule.totalRuns} run{schedule.totalRuns === 1 ? '' : 's'}</span>
                </div>
              </div>
              {canEdit && <div className="flex gap-2">
                <button type="button" disabled={mutating} onClick={() => void mutate(() => runScheduleNow(schedule.id))} aria-label={`Run ${schedule.name} now`} className="rounded-lg bg-white/5 p-2 text-blue-400"><Zap className="h-4 w-4" /></button>
                <button type="button" disabled={mutating} onClick={() => void mutate(() => toggleScheduleApi(schedule.id))} aria-label={`${schedule.status === 'active' ? 'Pause' : 'Resume'} ${schedule.name}`} className="rounded-lg bg-white/5 p-2 text-yellow-400">{schedule.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button type="button" disabled={mutating} onClick={() => { if (window.confirm(`Delete schedule “${schedule.name}”? Its generated artifacts will also be deleted.`)) void mutate(() => deleteSchedule(schedule.id)); }} aria-label={`Delete ${schedule.name}`} className="rounded-lg bg-white/5 p-2 text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>}
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="history-title" className="glass-card rounded-2xl p-5">
        <h2 id="history-title" className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary"><Clock className="h-4 w-4 text-accent-blue" />Run history</h2>
        {history.length === 0 ? <p className="text-sm text-text-secondary">No reports have run yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10 text-left text-xs text-text-muted"><th className="pb-2">Format</th><th className="pb-2">Status</th><th className="pb-2">Started</th><th className="pb-2">Duration</th><th className="pb-2">Size</th><th className="pb-2"><span className="sr-only">Download</span></th></tr></thead>
              <tbody>{history.map((run) => (
                <tr key={run.id} className="border-b border-white/5">
                  <td className="py-3 uppercase text-text-primary">{run.format}</td>
                  <td className="py-3"><span className={`rounded px-2 py-0.5 text-xs ${statusClass(run.status)}`}>{run.status}</span>{run.error && <span className="ml-2 text-xs text-red-400">{run.error}</span>}</td>
                  <td className="py-3 text-xs text-text-muted">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="py-3 text-xs text-text-secondary">{run.completedAt ? `${run.durationMs} ms` : '—'}</td>
                  <td className="py-3 text-xs text-text-secondary">{formatBytes(run.sizeBytes)}</td>
                  <td className="py-3 text-right">{run.downloadUrl && <a href={run.downloadUrl} className="inline-flex rounded-lg bg-white/5 p-2 text-text-secondary" aria-label={`Download ${run.format} report`}><Download className="h-4 w-4" /></a>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
