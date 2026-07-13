import Link from 'next/link';
import { AlertCircle, ArrowLeft, FlaskConical } from 'lucide-react';
import { getExperiment } from '@/lib/api';
import ProjectScopeRequired from '@/components/project-scope-required';

function date(value: string | null): string { return value ? new Date(value).toLocaleString() : '—'; }

export default async function ExperimentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ projectId?: string }> }) {
  const { id } = await params;
  const { projectId } = await searchParams;
  if (!projectId) return <ProjectScopeRequired feature="Experiment details" />;
  const experiment = await getExperiment(id, projectId);
  if (!experiment) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3"><AlertCircle className="h-9 w-9 text-text-muted" /><h1 className="font-semibold">Experiment not found</h1><Link href={`/experiments?projectId=${encodeURIComponent(projectId)}`} className="text-sm text-blue-400">Back to experiments</Link></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-6 pt-20 sm:px-6 lg:p-6">
      <Link href={`/experiments?projectId=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"><ArrowLeft className="h-4 w-4" />Experiments</Link>
      <header className="glass-card rounded-2xl p-6"><div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-purple-400" /><h1 className="text-xl font-bold">{experiment.name}</h1><span className="ml-auto rounded-full bg-white/5 px-3 py-1 text-xs text-text-secondary">{experiment.status}</span></div><p className="mt-2 text-sm text-text-secondary">{experiment.description || experiment.hypothesis}</p>{experiment.error && <p className="mt-3 text-sm text-red-400">{experiment.error}</p>}</header>

      <section className="glass-card rounded-2xl p-5"><h2 className="text-sm font-semibold">Hypothesis</h2><p className="mt-2 text-sm text-text-secondary">{experiment.hypothesis}</p></section>

      <section className="grid gap-4 md:grid-cols-2">{experiment.variants.map((variant, index) => {
        const result = experiment.results[index];
        return <article key={variant.name} className="glass-card rounded-2xl p-5"><h2 className="font-semibold">{index === 0 ? 'A' : 'B'} · {variant.name}</h2><p className="mt-1 text-xs text-text-muted">{variant.analyzers.length} analyzers · {variant.collectors.length} collectors · reasoning {variant.includeReasoning ? 'on' : 'off'}</p><div className="mt-3 flex flex-wrap gap-1">{variant.analyzers.map((analyzer) => <span key={analyzer} className="rounded bg-white/5 px-2 py-1 text-[10px] text-text-secondary">{analyzer}</span>)}</div>{result && <dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-text-muted">Health</dt><dd>{result.healthScore}</dd></div><div><dt className="text-xs text-text-muted">Findings</dt><dd>{result.findingCount}</dd></div><div><dt className="text-xs text-text-muted">Critical</dt><dd>{result.criticalFindingCount}</dd></div><div><dt className="text-xs text-text-muted">Duration</dt><dd>{result.durationMs} ms</dd></div></dl>}</article>;
      })}</section>

      {experiment.metrics.length > 0 && <section className="glass-card overflow-hidden rounded-2xl"><h2 className="border-b border-white/5 p-5 text-sm font-semibold">Measured comparison</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-text-muted"><th className="p-3">Metric</th><th className="p-3 text-right">A</th><th className="p-3 text-right">B</th><th className="p-3 text-right">Difference</th><th className="p-3">Preferred</th></tr></thead><tbody>{experiment.metrics.map((metric) => <tr key={metric.name} className="border-t border-white/5"><td className="p-3 text-text-secondary">{metric.name.replaceAll('_', ' ')}</td><td className="p-3 text-right">{metric.variant_a}</td><td className="p-3 text-right">{metric.variant_b}</td><td className="p-3 text-right">{metric.difference > 0 ? '+' : ''}{metric.difference}{metric.improvement_percent === null ? '' : ` (${metric.improvement_percent}%)`}</td><td className="p-3 uppercase text-text-secondary">{metric.preferred}</td></tr>)}</tbody></table></div></section>}

      <footer className="text-xs text-text-muted">Created {date(experiment.createdAt)} · Started {date(experiment.startedAt)} · Completed {date(experiment.completedAt)}</footer>
    </div>
  );
}
