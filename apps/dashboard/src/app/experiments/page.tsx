"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { getExperiments, createExperiment } from "@/lib/api";
import type { DashboardExperiment } from "@/lib/api";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  Clock,
  TrendingUp,
  Minus,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  completed: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  running: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  pending: { bg: "bg-white/5", text: "text-text-muted", dot: "bg-gray-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === "running" ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof FlaskConical;
  color: string;
}) {
  return (
    <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
      <Icon className={`h-5 w-5 ${color}`} />
      <span className="text-2xl font-bold text-text-primary tabular-nums">
        {value}
      </span>
      <span className="text-[11px] text-text-muted font-medium">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric row
// ---------------------------------------------------------------------------

function MetricRow({
  name,
  variantA,
  variantB,
  improvement,
}: {
  name: string;
  variantA: number;
  variantB: number;
  improvement: number;
}) {
  const isPositive = improvement > 0;
  const isNeutral = Math.abs(improvement) < 1;
  const color = isNeutral
    ? "text-text-muted"
    : isPositive
    ? "text-green-400"
    : "text-red-400";

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-text-secondary truncate flex-1">{name}</span>
      <div className="flex items-center gap-3 tabular-nums">
        <span className="text-text-muted w-14 text-right">{variantA}</span>
        <span className="text-text-primary w-14 text-right font-medium">{variantB}</span>
        <span className={`flex items-center gap-0.5 w-16 justify-end font-medium ${color}`}>
          {isNeutral ? (
            <Minus className="h-3 w-3" />
          ) : isPositive ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(improvement).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active experiment card
// ---------------------------------------------------------------------------

function ActiveExperimentCard({ experiment }: { experiment: DashboardExperiment }) {
  return (
    <div className="glass-card p-5 border-l-2 border-blue-400">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Play className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-text-primary">
              {experiment.name}
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">
            {experiment.hypothesis}
          </p>
        </div>
        <StatusBadge status={experiment.status} />
      </div>

      {/* Variants */}
      <div className="flex gap-2 mt-4">
        {experiment.variants.map((v) => (
          <span
            key={v.name}
            className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-text-secondary font-medium"
          >
            {v.name}
          </span>
        ))}
      </div>

      {/* Interim metrics */}
      {experiment.metrics.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
          <div className="flex items-center gap-4 text-[10px] text-text-muted mb-2">
            <span className="flex-1">Metric</span>
            <span className="w-14 text-right">Ctrl</span>
            <span className="w-14 text-right">Test</span>
            <span className="w-16 text-right">Change</span>
          </div>
          {experiment.metrics.map((m) => (
            <MetricRow
              key={m.name}
              name={m.name}
              variantA={m.variant_a}
              variantB={m.variant_b}
              improvement={m.improvement}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experiment card
// ---------------------------------------------------------------------------

function ExperimentCard({ experiment }: { experiment: DashboardExperiment }) {
  const hasMetrics = experiment.metrics.length > 0;
  const duration = experiment.started_at && experiment.completed_at
    ? formatDuration(experiment.started_at, experiment.completed_at)
    : experiment.started_at
    ? "In progress"
    : null;

  // Determine result type from conclusion
  const resultType = experiment.conclusion?.toLowerCase().includes("positive")
    ? "positive"
    : experiment.conclusion?.toLowerCase().includes("neutral")
    ? "neutral"
    : null;

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary leading-tight">
          {experiment.name}
        </h3>
        <StatusBadge status={experiment.status} />
      </div>

      {/* Hypothesis */}
      <p className="text-xs text-text-secondary line-clamp-2">
        {experiment.hypothesis}
      </p>

      {/* Metrics */}
      {hasMetrics && (
        <div className="space-y-1.5 border-t border-white/5 pt-3">
          <div className="flex items-center gap-4 text-[10px] text-text-muted mb-1">
            <span className="flex-1">Metric</span>
            <span className="w-14 text-right">Ctrl</span>
            <span className="w-14 text-right">Test</span>
            <span className="w-16 text-right">Change</span>
          </div>
          {experiment.metrics.slice(0, 3).map((m) => (
            <MetricRow
              key={m.name}
              name={m.name}
              variantA={m.variant_a}
              variantB={m.variant_b}
              improvement={m.improvement}
            />
          ))}
        </div>
      )}

      {/* Bottom row: duration + result */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
        {duration && (
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
        )}
        {resultType && (
          <span
            className={`text-[10px] font-semibold flex items-center gap-1 ${
              resultType === "positive"
                ? "text-green-400"
                : "text-amber-400"
            }`}
          >
            {resultType === "positive" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {resultType === "positive" ? "Positive" : "Neutral"}
          </span>
        )}
      </div>

      {/* Conclusion */}
      {experiment.conclusion && (
        <p className="text-[11px] text-text-secondary bg-white/3 rounded-lg px-3 py-2 leading-relaxed">
          {experiment.conclusion}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const EXPERIMENT_TYPES = ['A/B test', 'canary', 'feature-flag'] as const;

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<DashboardExperiment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newType, setNewType] = useState<string>(EXPERIMENT_TYPES[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getExperiments()
      .then((data) => setExperiments(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load experiments"),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const variants = newType === 'A/B test'
        ? [{ name: 'Control', config: {} }, { name: 'Treatment', config: {} }]
        : [{ name: newType, config: {} }];
      await createExperiment({
        name: newName.trim(),
        hypothesis: newHypothesis.trim() || undefined,
        variants,
      });
      setShowCreate(false);
      setNewName('');
      setNewHypothesis('');
      setNewType(EXPERIMENT_TYPES[0]);
      const data = await getExperiments();
      setExperiments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create experiment');
    } finally {
      setCreating(false);
    }
  };

  const running = experiments.filter((e) => e.status === "running");
  const completed = experiments.filter((e) => e.status === "completed");
  const pending = experiments.filter((e) => e.status === "pending");
  const successRate =
    completed.length > 0
      ? Math.round(
          (completed.filter((e) =>
            e.conclusion?.toLowerCase().includes("positive"),
          ).length /
            completed.length) *
            100,
        )
      : 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header
          title="Experiments"
          subtitle="Loading experiment data…"
        />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Header
          title="Experiments"
          subtitle={`${experiments.length} experiments · ${running.length} running`}
        />
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          New Experiment
        </button>
      </div>

      {/* Create Experiment Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h2 className="text-lg font-semibold text-text-primary">New Experiment</h2>

            <div>
              <label className="block text-xs text-text-muted font-medium mb-1">Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Strict Import Rules"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted font-medium mb-1">Hypothesis</label>
              <input
                type="text"
                value={newHypothesis}
                onChange={(e) => setNewHypothesis(e.target.value)}
                placeholder="What do you expect to happen?"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted font-medium mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {EXPERIMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => { setShowCreate(false); setError(null); }}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-text-secondary hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex-1 rounded-lg bg-gradient-to-r from-accent-blue to-accent-purple px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-all"
              >
                {creating ? 'Creating…' : 'Create Experiment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Failed to load experiments
            </p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Experiments"
          value={experiments.length}
          icon={FlaskConical}
          color="text-purple-400"
        />
        <StatCard
          label="Running"
          value={running.length}
          icon={Play}
          color="text-blue-400"
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          icon={CheckCircle2}
          color={successRate >= 60 ? "text-green-400" : successRate >= 40 ? "text-amber-400" : "text-red-400"}
        />
      </div>

      {/* Active Experiments */}
      {running.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Play className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-text-primary">
              Active Experiments
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {running.map((exp) => (
              <ActiveExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        </div>
      )}

      {/* Pending Experiments */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">
              Pending Experiments
            </h2>
            <span className="text-xs text-text-muted">
              ({pending.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Experiments */}
      {completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <h2 className="text-sm font-semibold text-text-primary">
              Completed Experiments
            </h2>
            <span className="text-xs text-text-muted">
              ({completed.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {completed.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
