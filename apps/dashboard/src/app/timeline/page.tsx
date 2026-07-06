import Header from "@/components/header";
import {
  Clock,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Layers,
  Camera,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Terminal,
  Brain,
} from "lucide-react";
import {
  getTimelineHistory,
  getTimelineSnapshots,
  getTimelineTrends,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function dimensionLabel(dim: string): string {
  return dim
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const DIMENSION_COLORS: Record<string, { text: string; bg: string }> = {
  overall_health: { text: "text-green-400", bg: "bg-green-500/10" },
  architecture: { text: "text-purple-400", bg: "bg-purple-500/10" },
  security: { text: "text-red-400", bg: "bg-red-500/10" },
  reliability: { text: "text-cyan-400", bg: "bg-cyan-500/10" },
  testing: { text: "text-amber-400", bg: "bg-amber-500/10" },
  ai: { text: "text-blue-400", bg: "bg-blue-500/10" },
  operational: { text: "text-orange-400", bg: "bg-orange-500/10" },
  documentation: { text: "text-green-400", bg: "bg-green-500/10" },
  developer_experience: { text: "text-pink-400", bg: "bg-pink-500/10" },
};

function getDimColor(dim: string) {
  return DIMENSION_COLORS[dim] ?? { text: "text-blue-400", bg: "bg-blue-500/10" };
}

// ---------------------------------------------------------------------------
// Inline Sparkline Component (SVG)
// ---------------------------------------------------------------------------

function TrendSparkline({
  values,
  color,
  height = 32,
  width = 120,
}: {
  values: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Glow dot on last point */}
      {(() => {
        const lastVal = values[values.length - 1];
        const x = width - padding;
        const y = height - padding - ((lastVal - min) / range) * (height - padding * 2);
        return <circle cx={x} cy={y} r="3" fill={color} opacity="0.8" />;
      })()}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TimelinePage() {
  let history: Awaited<ReturnType<typeof getTimelineHistory>> = [];
  let snapshots: Awaited<ReturnType<typeof getTimelineSnapshots>> = [];
  let trends: Awaited<ReturnType<typeof getTimelineTrends>> = { series: [], total: 0 };
  try {
    [history, snapshots, trends] = await Promise.all([
      getTimelineHistory(),
      getTimelineSnapshots(),
      getTimelineTrends(),
    ]);
  } catch {
    // Will use fallback values
  }

  const hasData = history.length > 0 || snapshots.length > 0;

  // Compute quick stats from trends
  const healthSeries = trends.series.find(
    (s) => s.dimension === "overall_health"
  );
  const healthValues = healthSeries?.data_points.map((p) => p.value) ?? [];
  const latestHealth = healthValues[healthValues.length - 1] ?? 0;
  const previousHealth = healthValues[healthValues.length - 2] ?? latestHealth;
  const healthDelta = latestHealth - previousHealth;

  const totalFindings = history.reduce((sum, h) => sum + h.findingCount, 0);
  const totalOpportunities = history.reduce(
    (sum, h) => sum + h.opportunityCount,
    0
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Evolution Timeline"
        subtitle="Track the evolution of your engineering intelligence over time"
      />

      <div className="flex-1 p-6 space-y-6 stagger-children">
        {/* ── Empty State ──────────────────────────────────── */}
        {!hasData && (
          <div className="glass-card p-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-accent-blue/20 mb-6">
              <Terminal className="h-8 w-8 text-accent-blue" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-2">
              No Timeline Data Yet
            </h2>
            <p className="text-sm text-text-secondary max-w-md mb-6">
              Run your first analysis to start tracking the evolution of your
              codebase over time.
            </p>
            <code className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] border border-border px-4 py-2.5 text-sm font-mono text-accent-blue">
              <Terminal className="h-4 w-4" />
              recurrsive analyze
            </code>
          </div>
        )}

        {hasData && (
          <>
            {/* ── Quick Stats ────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Health Trend */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10">
                    <Activity className="h-[18px] w-[18px] text-green-400" />
                  </div>
                  <span
                    className={`text-xs font-bold tabular-nums ${healthDelta >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {healthDelta >= 0 ? "+" : ""}
                    {healthDelta}
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-text-primary">
                  {latestHealth}
                  <span className="text-sm text-text-muted font-normal">
                    /100
                  </span>
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Current Health
                </p>
                {healthValues.length > 1 && (
                  <div className="mt-3">
                    <TrendSparkline
                      values={healthValues}
                      color="#22c55e"
                      width={160}
                      height={28}
                    />
                  </div>
                )}
              </div>

              {/* Analysis Runs */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                    <Clock className="h-[18px] w-[18px] text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-blue-400 tabular-nums">
                    {history.filter((h) => h.status === "success").length} passed
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-text-primary">
                  {history.length}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Analysis Runs
                </p>
              </div>

              {/* Total Findings */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                    <AlertTriangle className="h-[18px] w-[18px] text-amber-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums text-text-primary">
                  {totalFindings}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Total Findings
                </p>
              </div>

              {/* Total Opportunities */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
                    <Lightbulb className="h-[18px] w-[18px] text-purple-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums text-text-primary">
                  {totalOpportunities}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Opportunities Found
                </p>
              </div>
            </div>

            {/* ── Trends Section ─────────────────────────────── */}
            {trends.series.length > 0 && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text-primary">
                      Maturity Trends
                    </h2>
                    <p className="text-xs text-text-secondary">
                      Score evolution across {trends.series.length} dimensions
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {trends.series.map((series) => {
                    const values = series.data_points.map((p) => p.value);
                    const latest = values[values.length - 1] ?? 0;
                    const first = values[0] ?? latest;
                    const delta = latest - first;
                    const dimColor = getDimColor(series.dimension);
                    const sparkColor =
                      delta >= 0 ? "#22c55e" : "#ef4444";

                    return (
                      <div
                        key={series.dimension}
                        className="rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full ${dimColor.bg} px-2 py-0.5 text-[10px] font-semibold ${dimColor.text}`}
                          >
                            {dimensionLabel(series.dimension)}
                          </span>
                          <span
                            className={`flex items-center gap-0.5 text-xs font-bold tabular-nums ${delta >= 0 ? "text-green-400" : "text-red-400"}`}
                          >
                            {delta >= 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {delta >= 0 ? "+" : ""}
                            {delta}
                          </span>
                        </div>
                        <p className="text-xl font-bold tabular-nums text-text-primary mb-2">
                          {latest}
                          <span className="text-xs text-text-muted font-normal ml-1">
                            /100
                          </span>
                        </p>
                        <TrendSparkline
                          values={values}
                          color={sparkColor}
                          width={180}
                          height={28}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Analysis History Timeline ───────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-3">
                <div className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                      <Clock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-text-primary">
                        Analysis History
                      </h2>
                      <p className="text-xs text-text-secondary">
                        {history.length} analysis runs recorded
                      </p>
                    </div>
                  </div>

                  {/* Vertical Timeline */}
                  <div className="relative">
                    {/* Vertical line */}
                    <div
                      className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-accent-blue/40 via-accent-purple/20 to-transparent"
                      aria-hidden="true"
                    />

                    <div className="space-y-1">
                      {history.map((entry, i) => {
                        const isSuccess = entry.status === "success";
                        return (
                          <div
                            key={entry.id}
                            className="relative flex items-start gap-4 py-3"
                          >
                            {/* Timeline dot */}
                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                              <div
                                className={`h-3 w-3 rounded-full border-2 ${
                                  isSuccess
                                    ? "bg-green-500 border-green-400/30"
                                    : "bg-red-500 border-red-400/30"
                                }`}
                              />
                              {i === 0 && (
                                <span className="absolute inset-0 rounded-full bg-green-400/20 animate-pulse-dot" />
                              )}
                            </div>

                            {/* Card */}
                            <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {isSuccess ? (
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-red-400" />
                                  )}
                                  <span className="text-sm font-semibold text-text-primary">
                                    {formatDate(entry.startedAt)}
                                  </span>
                                  <span className="text-xs text-text-muted">
                                    {formatTime(entry.startedAt)}
                                  </span>
                                </div>
                                <span className="text-[10px] text-text-muted font-mono">
                                  {entry.id}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 mt-2">
                                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                                  <Clock className="h-3 w-3 text-text-muted" />
                                  {formatDuration(entry.durationMs)}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                                  {entry.findingCount} findings
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                                  <Lightbulb className="h-3 w-3 text-purple-400" />
                                  {entry.opportunityCount} opportunities
                                </span>
                                {entry.includeReasoning && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                                    <Brain className="h-2.5 w-2.5" />
                                    AI Reasoning
                                  </span>
                                )}
                              </div>

                              {entry.error && (
                                <p className="mt-2 text-xs text-red-400 bg-red-500/5 rounded-lg px-3 py-1.5 border border-red-500/10">
                                  {entry.error}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Snapshots Section ───────────────────────── */}
              <div className="xl:col-span-2">
                <div className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <Camera className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-text-primary">
                        Evolution Snapshots
                      </h2>
                      <p className="text-xs text-text-secondary">
                        {snapshots.length} snapshots captured
                      </p>
                    </div>
                  </div>

                  {snapshots.length === 0 ? (
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-6 text-center">
                      <Camera className="h-8 w-8 text-text-muted mx-auto mb-3" />
                      <p className="text-sm text-text-secondary">
                        No snapshots yet
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Run{" "}
                        <code className="text-accent-blue">
                          recurrsive analyze
                        </code>{" "}
                        to capture snapshots
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 stagger-children">
                      {snapshots.map((snap) => {
                        const delta = snap.changes_since_last;
                        const netOpps =
                          delta.new_opportunities - delta.resolved_opportunities;
                        const netRisks =
                          delta.new_risks - delta.resolved_risks;

                        return (
                          <div
                            key={snap.id}
                            className="rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-text-primary">
                                  {formatDate(snap.timestamp)}
                                </span>
                                <span className="text-xs text-text-muted">
                                  {formatTime(snap.timestamp)}
                                </span>
                              </div>
                              <span
                                className={`text-sm font-bold tabular-nums ${snap.overall_health >= 80 ? "text-green-400" : snap.overall_health >= 60 ? "text-amber-400" : "text-red-400"}`}
                              >
                                {snap.overall_health}
                              </span>
                            </div>

                            {/* Score deltas */}
                            {delta.maturity_changes.length > 0 && (
                              <div className="space-y-1.5 mb-3">
                                {delta.maturity_changes.map((change) => {
                                  const scoreDelta =
                                    change.current_score -
                                    change.previous_score;
                                  return (
                                    <div
                                      key={change.dimension}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="text-text-secondary capitalize">
                                        {dimensionLabel(change.dimension)}
                                      </span>
                                      <span
                                        className={`flex items-center gap-1 font-semibold tabular-nums ${scoreDelta >= 0 ? "text-green-400" : "text-red-400"}`}
                                      >
                                        {scoreDelta >= 0 ? (
                                          <ArrowUpRight className="h-3 w-3" />
                                        ) : (
                                          <ArrowDownRight className="h-3 w-3" />
                                        )}
                                        {change.previous_score} → {change.current_score}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Key changes */}
                            <div className="flex flex-wrap gap-2">
                              {netOpps !== 0 && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    netOpps > 0
                                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                      : "bg-green-500/10 border border-green-500/20 text-green-400"
                                  }`}
                                >
                                  {netOpps > 0 ? (
                                    <ArrowUpRight className="h-2.5 w-2.5" />
                                  ) : (
                                    <ArrowDownRight className="h-2.5 w-2.5" />
                                  )}
                                  {Math.abs(netOpps)} opp{Math.abs(netOpps) !== 1 ? "s" : ""}
                                  {netOpps > 0 ? " added" : " resolved"}
                                </span>
                              )}
                              {netRisks !== 0 && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    netRisks > 0
                                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                      : "bg-green-500/10 border border-green-500/20 text-green-400"
                                  }`}
                                >
                                  {netRisks > 0 ? (
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                  ) : (
                                    <CheckCircle className="h-2.5 w-2.5" />
                                  )}
                                  {Math.abs(netRisks)} risk{Math.abs(netRisks) !== 1 ? "s" : ""}
                                  {netRisks > 0 ? " new" : " resolved"}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] text-text-muted">
                                <Layers className="h-2.5 w-2.5" />
                                {snap.opportunity_count} opps · {snap.debt_count} debt · {snap.risk_count} risks
                              </span>
                            </div>

                            {/* Maturity scores */}
                            {snap.maturity_scores.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-white/5">
                                <div className="flex flex-wrap gap-1.5">
                                  {snap.maturity_scores.map((score) => {
                                    const dimColor = getDimColor(score.dimension);
                                    return (
                                      <span
                                        key={score.dimension}
                                        className={`inline-flex items-center gap-1 rounded-md ${dimColor.bg} px-1.5 py-0.5 text-[10px] ${dimColor.text}`}
                                      >
                                        {score.dimension.slice(0, 4)}
                                        <span className="font-bold tabular-nums">
                                          {score.score}
                                        </span>
                                        {score.trend === "improving" && (
                                          <ArrowUpRight className="h-2 w-2" />
                                        )}
                                        {score.trend === "declining" && (
                                          <ArrowDownRight className="h-2 w-2" />
                                        )}
                                        {score.trend === "stable" && (
                                          <Minus className="h-2 w-2" />
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
