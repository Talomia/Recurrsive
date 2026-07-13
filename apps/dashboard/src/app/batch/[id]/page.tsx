import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Layers, Loader2, XCircle } from 'lucide-react';
import { getBatchJob } from '@/lib/api';

const STATUS = {
  pending: { color: 'text-text-muted', background: 'bg-white/5', icon: Clock },
  running: { color: 'text-blue-400', background: 'bg-blue-500/10', icon: Loader2 },
  completed: { color: 'text-green-400', background: 'bg-green-500/10', icon: CheckCircle2 },
  partial: { color: 'text-amber-400', background: 'bg-amber-500/10', icon: AlertCircle },
  failed: { color: 'text-red-400', background: 'bg-red-500/10', icon: XCircle },
} as const;

function timestamp(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function duration(start: string, end?: string | null): string {
  const elapsed = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchJob(id);
  if (!batch) {
    return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"><AlertCircle className="h-10 w-10 text-text-muted" /><h1 className="text-lg font-semibold">Batch not found</h1><Link href="/batch" className="text-sm text-blue-400">Back to batch history</Link></div>;
  }

  const completed = batch.projects.filter((project) => project.status === 'completed').length;
  const terminal = batch.projects.filter((project) => project.status === 'completed' || project.status === 'failed').length;
  const progress = batch.projects.length ? Math.round((terminal / batch.projects.length) * 100) : 0;
  const batchStyle = STATUS[batch.status];
  const BatchIcon = batchStyle.icon;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-6 pt-20 sm:px-6 lg:p-6">
      <nav><Link href="/batch" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"><ArrowLeft className="h-4 w-4" />Batch history</Link></nav>
      <header className="glass-card rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2"><Layers className="h-5 w-5 text-blue-400" /><h1 className="text-xl font-bold">Batch analysis</h1></div><code className="mt-2 block text-xs text-text-muted">{batch.batch_id}</code></div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${batchStyle.background} ${batchStyle.color}`}><BatchIcon className={`h-3.5 w-3.5 ${batch.status === 'running' ? 'animate-spin' : ''}`} />{batch.status}</span>
        </div>
        <div className="mt-5 flex justify-between text-xs text-text-secondary"><span>{terminal} of {batch.projects.length} projects finished</span><span>{progress}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="glass-card p-4 text-center"><strong className="block text-2xl text-green-400">{completed}</strong><span className="text-xs text-text-muted">Completed</span></div>
        <div className="glass-card p-4 text-center"><strong className="block text-2xl text-red-400">{batch.projects.filter((project) => project.status === 'failed').length}</strong><span className="text-xs text-text-muted">Failed</span></div>
        <div className="glass-card p-4 text-center"><strong className="block text-sm text-text-primary">{duration(batch.created_at, batch.completed_at)}</strong><span className="text-xs text-text-muted">Duration</span></div>
        <div className="glass-card p-4 text-center"><strong className="block text-sm text-text-primary">{timestamp(batch.created_at)}</strong><span className="text-xs text-text-muted">Created</span></div>
      </div>

      <section className="glass-card overflow-hidden rounded-2xl" aria-labelledby="project-results-title">
        <h2 id="project-results-title" className="border-b border-white/5 p-5 text-sm font-semibold">Project results</h2>
        <div className="divide-y divide-white/5">
          {batch.projects.map((project) => {
            const projectStyle = STATUS[project.status];
            const ProjectIcon = projectStyle.icon;
            return (
              <article key={project.projectId} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <ProjectIcon className={`h-4 w-4 ${projectStyle.color} ${project.status === 'running' ? 'animate-spin' : ''}`} />
                <div className="min-w-0 flex-1"><Link href={`/projects/${encodeURIComponent(project.projectId)}`} className="font-medium text-text-primary hover:text-blue-400">{project.name}</Link><p className="truncate text-xs text-text-muted">{project.repository}</p>{project.error && <p className="mt-1 text-xs text-red-400">{project.error}</p>}</div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">{project.findings_count !== undefined && <span>{project.findings_count} findings</span>}{project.opportunities_count !== undefined && <span>{project.opportunities_count} opportunities</span>}<span className={`rounded px-2 py-1 ${projectStyle.background} ${projectStyle.color}`}>{project.status}</span></div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
