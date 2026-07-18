"use client";

import { useEffect, useState, useMemo } from "react";
import Header from "@/components/header";
import {
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { getAnalysisRuns, getComparisonData } from "@/lib/api";
import type { AnalysisRun } from "@/lib/api";
import LoadingSkeleton from "@/components/loading-skeleton";

// ---------------------------------------------------------------------------
// Delta display
// ---------------------------------------------------------------------------

function DeltaValue({
  value,
  suffix = "",
  invertColor = false,
}: {
  value: number;
  suffix?: string;
  invertColor?: boolean;
}) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  let color: string;
  if (isNeutral) {
    color = "text-text-muted";
  } else if (invertColor) {
    color = isPositive ? "text-red-400" : "text-green-400";
  } else {
    color = isPositive ? "text-green-400" : "text-red-400";
  }

  return (
    <span className={`inline-flex items-center gap-1 font-bold text-2xl tabular-nums ${color}`}>
      {isNeutral ? (
        <Minus className="h-5 w-5" />
      ) : isPositive ? (
        <ArrowUpRight className="h-5 w-5" />
      ) : (
        <ArrowDownRight className="h-5 w-5" />
      )}
      {isPositive ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Comparison card
// ---------------------------------------------------------------------------

function ComparisonCard({
  label,
  icon: Icon,
  iconColor,
  delta,
  runAValue,
  runBValue,
  invertColor,
}: {
  label: string;
  icon: typeof TrendingUp;
  iconColor: string;
  delta: number;
  runAValue: string | number;
  runBValue: string | number;
  invertColor?: boolean;
}) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <DeltaValue value={delta} invertColor={invertColor} />
      <div className="flex items-center justify-between text-xs text-text-muted border-t border-white/5 pt-2">
        <span>
          Run A: <span className="text-text-secondary font-medium">{runAValue}</span>
        </span>
        <span>
          Run B: <span className="text-text-primary font-medium">{runBValue}</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function fmtScore(value: number | null): string {
  return value === null ? "N/A" : String(value);
}

export default function ComparisonsPage() {
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");

  useEffect(() => {
    getAnalysisRuns()
      .then((data) => {
        setRuns(data);
        if (data.length >= 2) {
          setSelectedA(data[data.length - 2]!.id);
          setSelectedB(data[data.length - 1]!.id);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load runs"),
      )
      .finally(() => setLoading(false));
  }, []);

  // The comparison is computed from the two selected runs — all fields come
  // from data the server records per run, so no request is needed.
  const comparison = useMemo(() => {
    if (!selectedA || !selectedB || selectedA === selectedB) return null;
    const runA = runs.find((r) => r.id === selectedA);
    const runB = runs.find((r) => r.id === selectedB);
    if (!runA || !runB) return null;
    return getComparisonData(runA, runB);
  }, [runs, selectedA, selectedB]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Analysis Comparisons" subtitle="Loading analysis runs…" />
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Analysis Comparisons"
        subtitle={`Compare ${runs.length} analysis run${runs.length === 1 ? "" : "s"} side-by-side`}
      />

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">Error</p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Not enough runs to compare */}
      {!error && runs.length < 2 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="rounded-2xl bg-white/5 p-6">
            <GitCompare className="h-10 w-10 text-text-muted" />
          </div>
          <p className="text-sm text-text-muted text-center max-w-sm">
            At least two successful analysis runs are needed to compare. Run another
            analysis to unlock comparisons.
          </p>
        </div>
      )}

      {runs.length >= 2 && (
        <>
          {/* ── Comparison Selector ────────────────────────── */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitCompare className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-text-primary">
                Select Runs to Compare
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
              <div className="flex-1">
                <label
                  htmlFor="run-a-select"
                  className="block text-xs text-text-muted font-medium mb-1.5"
                >
                  Run A (Baseline)
                </label>
                <select
                  id="run-a-select"
                  value={selectedA}
                  onChange={(e) => setSelectedA(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-blue/40 transition-colors appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select a run…
                  </option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id} className="bg-surface text-text-primary">
                      {run.label} — {new Date(run.date).toLocaleDateString()} (Health: {fmtScore(run.health_score)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden sm:flex items-center justify-center px-2 pb-2">
                <GitCompare className="h-5 w-5 text-text-muted" />
              </div>

              <div className="flex-1">
                <label
                  htmlFor="run-b-select"
                  className="block text-xs text-text-muted font-medium mb-1.5"
                >
                  Run B (Comparison)
                </label>
                <select
                  id="run-b-select"
                  value={selectedB}
                  onChange={(e) => setSelectedB(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-blue/40 transition-colors appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select a run…
                  </option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id} className="bg-surface text-text-primary">
                      {run.label} — {new Date(run.date).toLocaleDateString()} (Health: {fmtScore(run.health_score)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedA === selectedB && selectedA && (
              <p className="mt-2 text-xs text-amber-400">
                Please select two different runs to compare.
              </p>
            )}
          </div>

          {/* ── Comparison Results ──────────────────────────── */}
          {comparison && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
                <ComparisonCard
                  label="Health Score"
                  icon={TrendingUp}
                  iconColor="text-green-400"
                  delta={comparison.health_delta}
                  runAValue={fmtScore(comparison.runA.health_score)}
                  runBValue={fmtScore(comparison.runB.health_score)}
                />
                <ComparisonCard
                  label="Findings Count"
                  icon={AlertTriangle}
                  iconColor="text-amber-400"
                  delta={comparison.findings_delta}
                  invertColor
                  runAValue={comparison.runA.findings}
                  runBValue={comparison.runB.findings}
                />
                <ComparisonCard
                  label="Opportunities"
                  icon={Lightbulb}
                  iconColor="text-blue-400"
                  delta={comparison.opportunities_delta}
                  runAValue={comparison.runA.opportunities}
                  runBValue={comparison.runB.opportunities}
                />
              </div>

              {/* ── Run Details ────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[comparison.runA, comparison.runB].map((run, i) => (
                  <div key={run.id} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          i === 0 ? "bg-blue-400" : "bg-cyan-400"
                        }`}
                      />
                      <h3 className="text-sm font-semibold text-text-primary">
                        {run.label}
                      </h3>
                      <span className="ml-auto text-[10px] text-text-muted">
                        {new Date(run.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-lg font-bold text-text-primary tabular-nums">
                          {fmtScore(run.health_score)}
                        </p>
                        <p className="text-[10px] text-text-muted">Health</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-text-primary tabular-nums">
                          {run.findings}
                        </p>
                        <p className="text-[10px] text-text-muted">Findings</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-text-primary tabular-nums">
                          {run.opportunities}
                        </p>
                        <p className="text-[10px] text-text-muted">Opportunities</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
