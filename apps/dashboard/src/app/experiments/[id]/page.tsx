import Link from "next/link";
import {
  ArrowLeft,
  FlaskConical,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Beaker,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { getExperiment } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  completed: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", border: "border-green-500/20" },
  running: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400", border: "border-blue-500/20" },
  pending: { bg: "bg-white/5", text: "text-text-muted", dot: "bg-gray-400", border: "border-white/10" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", border: "border-red-500/20" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ExperimentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExperimentDetailPage({ params }: ExperimentDetailPageProps) {
  const { id } = await params;
  const experiment = await getExperiment(id);

  if (!experiment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="rounded-2xl bg-white/5 p-6">
          <AlertCircle className="h-10 w-10 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          Experiment Not Found
        </h2>
        <p className="text-sm text-text-muted max-w-xs text-center">
          The experiment <span className="text-text-secondary font-mono">{id}</span> could
          not be found.
        </p>
        <Link
          href="/experiments"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Experiments
        </Link>
      </div>
    );
  }

  const status = STATUS_STYLES[experiment.status] ?? STATUS_STYLES.pending!;
  const duration =
    experiment.started_at && experiment.completed_at
      ? formatDuration(experiment.started_at, experiment.completed_at)
      : experiment.started_at
      ? "In progress"
      : "Not started";

  const resultType = experiment.conclusion?.toLowerCase().includes("positive")
    ? "positive"
    : experiment.conclusion?.toLowerCase().includes("neutral")
    ? "neutral"
    : null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link
          href="/experiments"
          className="inline-flex items-center gap-1.5 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Experiments
        </Link>
        <span>/</span>
        <span className="text-text-secondary font-mono text-xs">{experiment.id}</span>
      </nav>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <FlaskConical className="h-5 w-5 text-purple-400" />
              <h1 className="text-2xl font-bold text-text-primary leading-snug">
                {experiment.name}
              </h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-3xl">
              {experiment.description}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${status.bg} ${status.text} border ${status.border}`}
          >
            <span className={`h-2 w-2 rounded-full ${status.dot} ${experiment.status === "running" ? "animate-pulse" : ""}`} />
            {experiment.status}
          </span>
        </div>
      </div>

      {/* ── Info Cards Row ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          {experiment.status === "completed" ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : experiment.status === "running" ? (
            <Play className="h-5 w-5 text-blue-400" />
          ) : (
            <Clock className="h-5 w-5 text-text-muted" />
          )}
          <span className={`text-lg font-bold capitalize ${status.text}`}>
            {experiment.status}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Status</span>
        </div>

        {/* Duration Card */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Clock className="h-5 w-5 text-amber-400" />
          <span className="text-lg font-bold text-text-primary tabular-nums">
            {duration}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Duration</span>
        </div>

        {/* Variants Count Card */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Beaker className="h-5 w-5 text-purple-400" />
          <span className="text-2xl font-bold text-text-primary tabular-nums">
            {experiment.variants.length}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Variants</span>
        </div>
      </div>

      {/* ── Hypothesis Section ─────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-text-primary">Hypothesis</h2>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed bg-white/[0.02] rounded-xl px-4 py-3 border border-white/5">
          {experiment.hypothesis}
        </p>
      </div>

      {/* ── Variants Section ───────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Beaker className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-text-primary">Variants</h2>
          <span className="ml-auto text-xs text-text-muted">
            {experiment.variants.length} variant{experiment.variants.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {experiment.variants.map((variant, i) => (
            <div
              key={variant.name}
              className="rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-purple/10 text-[10px] font-bold text-purple-400">
                  {String.fromCharCode(65 + i)}
                </span>
                <h3 className="text-sm font-medium text-text-primary">{variant.name}</h3>
              </div>
              <div className="space-y-1.5 mt-3">
                {Object.entries(variant.config).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted font-mono">{key}</span>
                    <span className="text-text-secondary font-medium">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Metrics Table ──────────────────────────────── */}
      {experiment.metrics.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-text-primary">Metrics</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    Variant A
                  </th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    Variant B
                  </th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    Improvement
                  </th>
                </tr>
              </thead>
              <tbody>
                {experiment.metrics.map((m) => {
                  const isPositive = m.improvement > 0;
                  const isNeutral = Math.abs(m.improvement) < 1;
                  const color = isNeutral
                    ? "text-text-muted"
                    : isPositive
                    ? "text-green-400"
                    : "text-red-400";

                  return (
                    <tr key={m.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 text-text-secondary">{m.name}</td>
                      <td className="py-3 px-3 text-right text-text-muted tabular-nums">{m.variant_a}</td>
                      <td className="py-3 px-3 text-right text-text-primary font-medium tabular-nums">{m.variant_b}</td>
                      <td className={`py-3 px-3 text-right font-medium tabular-nums ${color}`}>
                        <span className="inline-flex items-center gap-1 justify-end">
                          {isNeutral ? (
                            <Minus className="h-3 w-3" />
                          ) : isPositive ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {Math.abs(m.improvement).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Conclusion ─────────────────────────────────── */}
      {experiment.conclusion && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            {resultType === "positive" ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : resultType === "neutral" ? (
              <Minus className="h-4 w-4 text-amber-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
            <h2 className="text-sm font-semibold text-text-primary">Conclusion</h2>
            {resultType && (
              <span
                className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  resultType === "positive"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}
              >
                {resultType === "positive" ? "Positive Result" : "Neutral Result"}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary leading-relaxed bg-white/[0.02] rounded-xl px-4 py-3 border border-white/5">
            {experiment.conclusion}
          </p>
        </div>
      )}

      {/* ── Timeline ───────────────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-text-primary">Timeline</h2>
        </div>
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-white/10" />

          <div className="space-y-4">
            {/* Created */}
            <div className="relative flex items-start gap-3">
              <span className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full bg-purple-400 ring-2 ring-surface z-10" />
              <div>
                <p className="text-xs font-medium text-text-primary">Created</p>
                <p className="text-[11px] text-text-muted">{formatDate(experiment.created_at)}</p>
              </div>
            </div>

            {/* Started */}
            <div className="relative flex items-start gap-3">
              <span className={`absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface z-10 ${experiment.started_at ? "bg-blue-400" : "bg-white/20"}`} />
              <div>
                <p className="text-xs font-medium text-text-primary">Started</p>
                <p className="text-[11px] text-text-muted">{formatDate(experiment.started_at)}</p>
              </div>
            </div>

            {/* Completed */}
            <div className="relative flex items-start gap-3">
              <span className={`absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface z-10 ${experiment.completed_at ? "bg-green-400" : "bg-white/20"}`} />
              <div>
                <p className="text-xs font-medium text-text-primary">Completed</p>
                <p className="text-[11px] text-text-muted">{formatDate(experiment.completed_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
