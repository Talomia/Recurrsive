'use client';
/**
 * Report Scheduling page.
 *
 * Scheduled reports, cron display, run history, and create schedule form.
 */

import { useState, useEffect } from 'react';
import { Calendar, Clock, Play, Pause, Download, FileText, Trash2, Zap } from 'lucide-react';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import {
  getSchedules, getScheduleHistory,
  createSchedule, toggleSchedule as toggleScheduleApi,
  deleteSchedule, runScheduleNow,
} from '@/lib/api';
import type { ReportSchedule, ScheduleRunHistory } from '@/lib/api';

type Schedule = ReportSchedule;
type RunHistory = ScheduleRunHistory;
function ScheduleStatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
      {status}
    </span>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    running: 'bg-blue-500/20 text-blue-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>{status}</span>;
}

function ReportTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    executive: 'bg-purple-500/20 text-purple-400',
    technical: 'bg-blue-500/20 text-blue-400',
    compliance: 'bg-orange-500/20 text-orange-400',
    custom: 'bg-gray-500/20 text-gray-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type]}`}>{type}</span>;
}

function getCountdown(target: string): string {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function SchedulingPage() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [history, setHistory] = useState<RunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCron, setNewCron] = useState('');
  const [newFormat, setNewFormat] = useState('pdf');
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refetchData = async () => {
    const [sched, hist] = await Promise.all([getSchedules(), getScheduleHistory()]);
    setSchedules(sched);
    setHistory(hist);
  };

  useEffect(() => {
    refetchData().finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setError(null);
    setMutating(true);
    try {
      await createSchedule({ name: newName, schedule: newCron, format: newFormat });
      setShowCreate(false);
      setNewName('');
      setNewCron('');
      setNewFormat('pdf');
      await refetchData();
      toast('Schedule created.', 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create schedule');
      toast('Failed to create schedule.', 'error');
    } finally {
      setMutating(false);
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    setError(null);
    const resuming = schedule.status !== 'active';
    try {
      await toggleScheduleApi(schedule.id);
      await refetchData();
      toast(resuming ? `Schedule "${schedule.name}" resumed.` : `Schedule "${schedule.name}" paused.`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle schedule');
      toast('Failed to update schedule.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSchedule(deleteTarget.id);
      await refetchData();
      toast(`Schedule "${deleteTarget.name}" deleted.`, 'info');
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete schedule');
      toast('Failed to delete schedule.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRunNow = async (id: string, name: string) => {
    setError(null);
    try {
      await runScheduleNow(id);
      await refetchData();
      toast(`Run started for "${name}".`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to trigger run');
      toast('Failed to trigger run.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Scheduling" subtitle="Manage recurring analysis schedules and view run history" />
        <LoadingSkeleton variant="list" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Scheduling" subtitle="Manage recurring analysis schedules and view run history" />
      <div className="flex items-center justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
          <Calendar className="w-4 h-4" /> New Schedule
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-500/20 text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4 font-bold">×</button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-3">Create New Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Schedule Name" aria-label="Schedule Name" value={newName} onChange={e => setNewName(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Cron Expression (e.g. 0 9 * * 1)" aria-label="Cron Expression" value={newCron} onChange={e => setNewCron(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <select value={newFormat} onChange={e => setNewFormat(e.target.value)} aria-label="Report format" className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
              <option value="pdf">PDF</option>
              <option value="html">HTML</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button disabled={!newName || !newCron || mutating} onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: newName && newCron ? 'var(--color-accent)' : 'var(--color-border)', opacity: newName && newCron ? 1 : 0.5 }}>
              {mutating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Schedules */}
      <div className="space-y-3">
        {schedules.length === 0 && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-text-tertiary" />
            <p className="text-sm text-text-secondary">No schedules yet. Create one to automate report generation.</p>
          </div>
        )}
        {schedules.map(schedule => (
          <div key={schedule.id} className="glass-card rounded-2xl p-5 transition-all hover:scale-[1.005]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-text-tertiary" />
                  <h2 className="text-sm font-semibold text-text-primary">{schedule.name}</h2>
                  <ReportTypeBadge type={schedule.reportType} />
                  <ScheduleStatusBadge status={schedule.status} />
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 uppercase">{schedule.format}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {schedule.cronHuman}</span>
                  <span className="font-mono" style={{ color: 'var(--color-accent)' }}>{schedule.cron}</span>
                  <span>•</span>
                  <span>{schedule.recipients.length} recipient{schedule.recipients.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-1">
                  <p className="text-xs text-text-tertiary">Next run</p>
                  <p className="text-sm font-semibold text-text-primary">{getCountdown(schedule.nextRun)}</p>
                </div>
                <button onClick={() => handleRunNow(schedule.id, schedule.name)} title="Run Now" aria-label={`Run ${schedule.name} now`} className="p-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }}>
                  <Zap className="w-4 h-4 text-blue-400" aria-hidden="true" />
                </button>
                <button onClick={() => handleToggle(schedule)} title={schedule.status === 'active' ? 'Pause' : 'Resume'} aria-label={`${schedule.status === 'active' ? 'Pause' : 'Resume'} ${schedule.name}`} className="p-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }}>
                  {schedule.status === 'active' ? <Pause className="w-4 h-4 text-yellow-400" aria-hidden="true" /> : <Play className="w-4 h-4 text-green-400" aria-hidden="true" />}
                </button>
                <button onClick={() => setDeleteTarget(schedule)} title="Delete" aria-label={`Delete ${schedule.name}`} className="p-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }}>
                  <Trash2 className="w-4 h-4 text-red-400" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Run History */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Run History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th scope="col" className="pb-2 font-medium">Report</th>
                <th scope="col" className="pb-2 font-medium">Status</th>
                <th scope="col" className="pb-2 font-medium">Started</th>
                <th scope="col" className="pb-2 font-medium">Completed</th>
                <th scope="col" className="pb-2 font-medium">Size</th>
                <th scope="col" className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(run => (
                <tr key={run.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-3 text-text-primary">{run.scheduleName}</td>
                  <td className="py-3"><RunStatusBadge status={run.status} /></td>
                  <td className="py-3 text-text-tertiary text-xs">{formatDateTime(run.startedAt)}</td>
                  <td className="py-3 text-text-tertiary text-xs">{run.completedAt ? formatDateTime(run.completedAt) : '—'}</td>
                  <td className="py-3 text-text-secondary text-xs">{run.fileSize}</td>
                  <td className="py-3">
                    {run.status === 'success' && run.downloadUrl && (
                      <a
                        href={run.downloadUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex p-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'var(--color-base)' }}
                        title="Download report"
                        aria-label={`Download report for ${run.scheduleName}`}
                      >
                        <Download className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete schedule"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Delete schedule{' '}
            <span className="font-semibold text-text-primary">{deleteTarget?.name}</span>? It will stop
            generating reports. This action cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
