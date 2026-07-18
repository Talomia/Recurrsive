import Header from "@/components/header";
import { getSnapshots } from "@/lib/api";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import {
  Camera,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Lightbulb,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-amber-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 85) return "bg-green-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-red-500";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page component (server component)
// ---------------------------------------------------------------------------

export default async function SnapshotsPage() {
  let snapshots: Awaited<ReturnType<typeof getSnapshots>> = [];
  let loadError: string | null = null;
  try {
    snapshots = await getSnapshots();
  } catch (err) {
    // Distinguish a real failure from a genuinely empty snapshot list below.
    loadError = err instanceof Error ? err.message : "Failed to load snapshots";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Project Snapshots"
        subtitle={`${snapshots.length} snapshots captured over time`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Camera className="h-5 w-5 text-blue-400" />
          <span className="text-2xl font-bold text-text-primary tabular-nums">
            {snapshots.length}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Total Snapshots</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <TrendingUp className="h-5 w-5 text-green-400" />
          <span className={`text-2xl font-bold tabular-nums ${getScoreColor(snapshots[0]?.health_score ?? 0)}`}>
            {snapshots[0]?.health_score ?? "—"}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Latest Health</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <span className="text-2xl font-bold text-amber-400 tabular-nums">
            {snapshots[0]?.findings_count ?? "—"}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Latest Findings</span>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Snapshot Timeline</h2>
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
            {snapshots.length}
          </span>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <ErrorState
              title="Failed to load snapshots"
              message={loadError}
            />
          </div>
        ) : snapshots.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="No snapshots yet"
            description="Run an analysis to capture your first project snapshot. Snapshots track how your health score and findings evolve over time."
            action={{ label: 'Go to Projects', href: '/projects' }}
          />
        ) : (
          <div className="relative pl-6 space-y-4">
            {/* Vertical timeline line */}
            <div className="absolute left-[11px] top-4 bottom-4 w-px bg-white/10" aria-hidden="true" />

            {snapshots.map((snapshot, idx) => {
              const prevScore = snapshots[idx + 1]?.health_score ?? snapshot.health_score;
              const delta = snapshot.health_score - prevScore;

              return (
                <details
                  key={snapshot.id}
                  className="group relative rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15"
                >
                  {/* Timeline dot */}
                  <span
                    className={`absolute -left-6 top-5 h-3 w-3 rounded-full ring-2 ring-surface z-10 ${getScoreBg(snapshot.health_score)}`}
                    aria-hidden="true"
                  />

                  <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                    {/* Date */}
                    <div className="flex-none min-w-[140px]">
                      <p className="text-xs font-medium text-text-primary">
                        {formatDate(snapshot.date)}
                      </p>
                    </div>

                    {/* Health Score */}
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <span className={`text-lg font-bold tabular-nums ${getScoreColor(snapshot.health_score)}`}>
                        {snapshot.health_score}
                      </span>
                      {delta !== 0 && idx < snapshots.length - 1 && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${delta > 0 ? "text-green-400" : "text-red-400"}`}>
                          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {delta > 0 ? "+" : ""}{delta}
                        </span>
                      )}
                      {delta === 0 && idx < snapshots.length - 1 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-text-muted">
                          <Minus className="h-3 w-3" />
                        </span>
                      )}
                    </div>

                    {/* Findings count */}
                    <span className="text-xs text-text-secondary hidden sm:block">
                      {snapshot.findings_count} findings
                    </span>

                    {/* Opportunities */}
                    <span className="text-xs text-text-secondary hidden md:block">
                      {snapshot.opportunities_count} opps
                    </span>

                    <ChevronDown className="h-4 w-4 text-text-muted ml-auto transition-transform group-open:rotate-180" />
                  </summary>

                  {/* Expanded detail */}
                  <div className="border-t border-white/5 px-5 py-4 space-y-3 animate-fade-in-up">
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {snapshot.summary}
                    </p>

                    {/* Dimension scores */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(snapshot.dimensions).map(([dim, score]) => (
                        <div key={dim} className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col items-center gap-1.5">
                          <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
                            {dim}
                          </span>
                          <span className={`text-lg font-bold tabular-nums ${getScoreColor(score)}`}>
                            {score}
                          </span>
                          <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getScoreBg(score)}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Metadata row */}
                    <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-white/5">
                      <span className="inline-flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        {snapshot.findings_count} findings
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        {snapshot.opportunities_count} opportunities
                      </span>
                      <span className="font-mono">{snapshot.id}</span>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
