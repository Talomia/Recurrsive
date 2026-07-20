import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Play,
  Timer,
  ListChecks,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { getBatchJob } from "@/lib/api";
import type { BatchProject } from "@/lib/api";

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  pending:   { bg: "bg-white/5",       text: "text-text-muted",  dot: "bg-gray-400",    border: "border-white/10" },
  running:   { bg: "bg-blue-500/10",   text: "text-blue-400",    dot: "bg-blue-400",    border: "border-blue-500/20" },
  completed: { bg: "bg-green-500/10",  text: "text-green-400",   dot: "bg-green-400",   border: "border-green-500/20" },
  partial:   { bg: "bg-amber-500/10",  text: "text-amber-400",   dot: "bg-amber-400",   border: "border-amber-500/20" },
  failed:    { bg: "bg-red-500/10",    text: "text-red-400",     dot: "bg-red-400",     border: "border-red-500/20" },
};

const PROJECT_STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.pending!;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return "—";
  if (!endIso) return "In progress";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

// ---------------------------------------------------------------------------
// Project row
// ---------------------------------------------------------------------------

function ProjectRow({ project }: { project: BatchProject }) {
  const sc = statusStyle(project.status);
  const StatusIcon = PROJECT_STATUS_ICONS[project.status] ?? Clock;
  const basename = project.path.split("/").pop() || project.path;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <StatusIcon className={`h-4 w-4 shrink-0 ${sc.text} ${project.status === "running" ? "animate-spin" : ""}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{basename}</p>
        <p className="text-[10px] text-text-muted truncate">{project.path}</p>
        {project.error && (
          <p className="text-[10px] text-red-400 mt-0.5 truncate">{project.error}</p>
        )}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${sc.bg} ${sc.text} ${sc.border}`}>
        {project.status}
      </span>
      <span className="text-[10px] text-text-muted hidden md:block">
        {formatDate(project.started_at)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface BatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BatchDetailPage({ params }: BatchDetailPageProps) {
  const { id } = await params;
  const batch = await getBatchJob(id);

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="rounded-2xl bg-white/5 p-6">
          <AlertCircle className="h-10 w-10 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          Batch Job Not Found
        </h2>
        <p className="text-sm text-text-muted max-w-xs text-center">
          The batch job <span className="text-text-secondary font-mono">{id}</span> could
          not be found.
        </p>
        <Link
          href="/batch"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Batch Analysis
        </Link>
      </div>
    );
  }

  const status = statusStyle(batch.status);
  const total = batch.projects.length;
  const completed = batch.projects.filter((p) => p.status === "completed").length;
  const failed = batch.projects.filter((p) => p.status === "failed").length;
  // Guard against divide-by-zero for an empty batch.
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const errors = batch.projects
    .filter((p) => p.status === "failed" && p.error)
    .map((p) => `${p.path}: ${p.error}`);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link
          href="/batch"
          className="inline-flex items-center gap-1.5 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Batch
        </Link>
        <span>/</span>
        <span className="text-text-secondary font-mono text-xs">{batch.batch_id}</span>
      </nav>

      {/* Header */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Layers className="h-5 w-5 text-blue-400" />
              <h1 className="text-2xl font-bold text-text-primary leading-snug font-mono">
                {batch.batch_id}
              </h1>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Submitted {formatDate(batch.created_at)} · {formatDuration(batch.created_at, batch.completed_at)}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${status.bg} ${status.text} ${status.border}`}>
            <span className={`h-2 w-2 rounded-full ${status.dot} ${batch.status === "running" ? "animate-pulse" : ""}`} />
            {batch.status}
          </span>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary">
              {completed} of {total} projects complete
            </span>
            <span className="text-xs font-medium text-blue-400 tabular-nums">
              {progressPercent}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                batch.status === "completed"
                  ? "bg-gradient-to-r from-green-500 to-green-400"
                  : batch.status === "failed"
                  ? "bg-gradient-to-r from-red-500 to-red-400"
                  : batch.status === "partial"
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : "bg-gradient-to-r from-blue-500 to-blue-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <ListChecks className="h-5 w-5 text-green-400" />
          <span className="text-2xl font-bold text-green-400 tabular-nums">{completed}</span>
          <span className="text-[11px] text-text-muted font-medium">Completed</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <FolderOpen className="h-5 w-5 text-blue-400" />
          <span className="text-2xl font-bold text-text-primary tabular-nums">{total}</span>
          <span className="text-[11px] text-text-muted font-medium">Projects</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <XCircle className="h-5 w-5 text-red-400" />
          <span className="text-2xl font-bold text-red-400 tabular-nums">{failed}</span>
          <span className="text-[11px] text-text-muted font-medium">Failed</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Timer className="h-5 w-5 text-amber-400" />
          <span className="text-lg font-bold text-text-primary tabular-nums">{formatDuration(batch.created_at, batch.completed_at)}</span>
          <span className="text-[11px] text-text-muted font-medium">Duration</span>
        </div>
      </div>

      {/* Project List */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Play className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-text-primary">Projects</h2>
          <span className="ml-auto text-xs text-text-muted">
            {total} project{total !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {batch.projects.map((project, idx) => (
            <ProjectRow key={`${batch.batch_id}-${idx}`} project={project} />
          ))}
          {total === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              This batch contains no projects.
            </div>
          )}
        </div>
      </div>

      {/* Error Log */}
      {errors.length > 0 && (
        <div className="rounded-2xl bg-red-500/[0.03] border border-red-500/15 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Error Log</h2>
          </div>
          <div className="space-y-2">
            {errors.map((error, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg bg-red-500/5 border border-red-500/10 p-3"
              >
                <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
