import Header from "@/components/header";
import NewBatchButton from "./NewBatchButton";
import { getBatchHistory } from "@/lib/api";
import type { BatchRun, BatchProject } from "@/lib/api";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  FolderOpen,
  BarChart3,
  Activity,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  running:   { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  completed: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  partial:   { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  pending:   { bg: "bg-white/5", text: "text-text-muted", border: "border-white/10" },
  failed:    { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? { bg: "bg-white/5", text: "text-text-secondary", border: "border-white/10" };
}

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  running: Loader2,
  completed: CheckCircle2,
  partial: AlertTriangle,
  pending: Clock,
  failed: XCircle,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startIso: string, endIso?: string): string {
  if (!endIso) return "In progress";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

// ---------------------------------------------------------------------------
// Project detail row
// ---------------------------------------------------------------------------

function ProjectRow({ project }: { project: BatchProject }) {
  const sc = getStatusColor(project.status);
  const StatusIcon = STATUS_ICONS[project.status] ?? Clock;

  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
      {/* Status icon */}
      <StatusIcon
        className={`h-4 w-4 shrink-0 ${sc.text} ${
          project.status === "running" ? "animate-spin" : ""
        }`}
      />

      {/* Project path */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">
          {project.name}
        </p>
        <p className="text-[10px] text-text-muted truncate">{project.repository}</p>
      </div>

      {/* Status badge */}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${sc.bg} ${sc.text} ${sc.border}`}
      >
        {project.status}
      </span>

      {/* Findings/Opportunities */}
      {project.findings_count !== undefined && (
        <span className="text-[10px] text-text-secondary tabular-nums hidden sm:block">
          {project.findings_count} findings
        </span>
      )}
      {project.opportunities_count !== undefined && (
        <span className="text-[10px] text-text-secondary tabular-nums hidden md:block">
          {project.opportunities_count} opportunities
        </span>
      )}

      {/* Error */}
      {project.error && (
        <span className="text-[10px] text-red-400 truncate max-w-[200px] hidden lg:block">
          {project.error}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable batch row
// ---------------------------------------------------------------------------

function BatchCard({ batch }: { batch: BatchRun }) {
  const sc = getStatusColor(batch.status);
  const StatusIcon = STATUS_ICONS[batch.status] ?? Clock;
  const completedCount = batch.projects.filter(
    (p) => p.status === "completed"
  ).length;
  const totalCount = batch.projects.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
      {/* Summary row */}
      <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer list-none select-none">
        <ChevronDown className="h-4 w-4 text-text-muted shrink-0 transition-transform group-open:rotate-180" />

        <StatusIcon
          className={`h-4 w-4 shrink-0 ${sc.text} ${
            batch.status === "running" ? "animate-spin" : ""
          }`}
        />

        {/* Batch ID */}
        <span className="text-xs font-mono font-medium text-text-primary">
          {batch.batch_id}
        </span>

        {/* Status badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${sc.bg} ${sc.text} ${sc.border}`}
        >
          {batch.status}
        </span>

        {/* Projects count */}
        <span className="text-[10px] text-text-secondary hidden sm:block">
          {completedCount}/{totalCount} projects
        </span>

        {/* Progress bar (compact) */}
        <div className="hidden sm:block flex-1 max-w-[120px]">
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                batch.status === "completed"
                  ? "bg-green-500"
                  : batch.status === "failed"
                  ? "bg-red-500"
                  : batch.status === "partial"
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Date */}
        <span className="text-[10px] text-text-muted ml-auto hidden md:block">
          {formatDate(batch.created_at)}
        </span>

        {/* Duration */}
        <span className="text-[10px] text-text-secondary hidden lg:block">
          {formatDuration(batch.created_at, batch.completed_at ?? undefined)}
        </span>
      </summary>

      {/* Expanded detail */}
      <div className="border-t border-white/5">
        {batch.projects.map((project, idx) => (
          <ProjectRow key={`${batch.batch_id}-${idx}`} project={project} />
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Page component (server component)
// ---------------------------------------------------------------------------

export default async function BatchPage() {
  let batches: BatchRun[] = [];
  let error: string | null = null;

  try {
    batches = await getBatchHistory();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load batch data";
  }

  const totalBatches = batches.length;
  const totalProjects = batches.reduce((sum, b) => sum + b.projects.length, 0);
  const completedProjects = batches.reduce(
    (sum, b) => sum + b.projects.filter((p) => p.status === "completed").length,
    0
  );
  const successRate =
    totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

  const activeBatch = batches.find((b) => b.status === "running");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <Header
          title="Batch Analysis"
          subtitle={`${totalBatches} batch runs · ${totalProjects} projects analyzed`}
        />
        <NewBatchButton />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Failed to load batch data
            </p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Layers className="h-5 w-5 text-blue-400" />
          <span className="text-2xl font-bold text-text-primary tabular-nums">
            {totalBatches}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Total Batches
          </span>
        </div>

        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <FolderOpen className="h-5 w-5 text-purple-400" />
          <span className="text-2xl font-bold text-purple-400 tabular-nums">
            {totalProjects}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Projects Analyzed
          </span>
        </div>

        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <BarChart3 className="h-5 w-5 text-green-400" />
          <span
            className={`text-2xl font-bold tabular-nums ${
              successRate >= 80
                ? "text-green-400"
                : successRate >= 50
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {successRate}%
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Success Rate
          </span>
        </div>
      </div>

      {/* Active batch */}
      {activeBatch && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-blue-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-text-primary">
              Active Batch
            </h2>
            <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400 font-medium">
              {activeBatch.batch_id}
            </span>
          </div>

          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.03] overflow-hidden">
            {/* Progress header */}
            <div className="px-5 py-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">
                  {activeBatch.projects.filter((p) => p.status === "completed").length} of{" "}
                  {activeBatch.projects.length} projects complete
                </span>
                <span className="text-xs font-medium text-blue-400 tabular-nums">
                  {Math.round(
                    (activeBatch.projects.filter((p) => p.status === "completed").length /
                      activeBatch.projects.length) *
                      100
                  )}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (activeBatch.projects.filter((p) => p.status === "completed").length /
                        activeBatch.projects.length) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Per-project rows */}
            {activeBatch.projects.map((project, idx) => (
              <ProjectRow key={`active-${idx}`} project={project} />
            ))}
          </div>
        </div>
      )}

      {/* History section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Batch History
          </h2>
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
            {batches.length}
          </span>
        </div>

        {batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-blue-500/10 p-4 mb-4">
              <Layers className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-text-primary mb-1">
              No Batch Runs Yet
            </h3>
            <p className="text-xs text-text-muted max-w-xs">
              Start a batch analysis to process multiple projects at once.
              Results will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {batches.map((batch) => (
              <BatchCard key={batch.batch_id} batch={batch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
