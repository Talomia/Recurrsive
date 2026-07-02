"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/header";
import {
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  BarChart3,
} from "lucide-react";
import { getAnalysisRuns, getComparisonData } from "@/lib/api";
import type { AnalysisRun, ComparisonData } from "@/lib/api";

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
  const isNeutral = Math.abs(value) < 0.5;

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
  suffix,
  runAValue,
  runBValue,
  invertColor,
}: {
  label: string;
  icon: typeof TrendingUp;
  iconColor: string;
  delta: number;
  suffix?: string;
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
      <DeltaValue value={delta} suffix={suffix} invertColor={invertColor} />
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
// Category bar chart
// ---------------------------------------------------------------------------

function CategoryBar({
  name,
  countA,
  countB,
  maxCount,
}: {
  name: string;
  countA: number;
  countB: number;
  maxCount: number;
}) {
  const widthA = maxCount > 0 ? (countA / maxCount) * 100 : 0;
  const widthB = maxCount > 0 ? (countB / maxCount) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary font-medium">{name}</span>
        <div className="flex items-center gap-3 tabular-nums text-[11px]">
          <span className="text-blue-400">{countA}</span>
          <span className="text-text-muted">vs</span>
          <span className="text-cyan-400">{countB}</span>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="h-3 rounded-l-full bg-blue-500/20 overflow-hidden flex-1">
          <div
            className="h-full rounded-l-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${widthA}%` }}
          />
        </div>
        <div className="h-3 rounded-r-full bg-cyan-500/20 overflow-hidden flex-1">
          <div
            className="h-full rounded-r-full bg-cyan-500 transition-all duration-500 ease-out"
            style={{ width: `${widthB}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComparisonsPage() {
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [comparing, setComparing] = useState(false);

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

  const handleCompare = useCallback(async () => {
    if (!selectedA || !selectedB || selectedA === selectedB) return;
    setComparing(true);
    try {
      const data = await getComparisonData(selectedA, selectedB);
      setComparison(data);
    } catch {
      setError("Failed to compare runs");
    } finally {
      setComparing(false);
    }
  }, [selectedA, selectedB]);

  // Auto-compare when selections change
  useEffect(() => {
    if (!selectedA || !selectedB || selectedA === selectedB) return;
    let cancelled = false;
    const compare = async () => {
      try {
        const data = await getComparisonData(selectedA, selectedB);
        if (!cancelled) {
          setComparison(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to compare runs");
        }
      } finally {
        if (!cancelled) {
          setComparing(false);
        }
      }
    };
    setComparing(true);
    compare();
    return () => { cancelled = true; };
  }, [selectedA, selectedB]);

  // Get max category count for bar chart scaling
  const maxCategoryCount = comparison
    ? Math.max(
        ...comparison.runA.categories.map((c) => c.count),
        ...comparison.runB.categories.map((c) => c.count),
      )
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Analysis Comparisons" subtitle="Loading analysis runs…" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <Header
        title="Analysis Comparisons"
        subtitle={`Compare ${runs.length} analysis runs side-by-side`}
      />

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">Error</p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

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
                  {run.label} — {new Date(run.date).toLocaleDateString()} (Health: {run.health_score})
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
                  {run.label} — {new Date(run.date).toLocaleDateString()} (Health: {run.health_score})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCompare}
            disabled={!selectedA || !selectedB || selectedA === selectedB || comparing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Search className="h-4 w-4" />
            {comparing ? "Comparing…" : "Compare"}
          </button>
        </div>

        {selectedA === selectedB && selectedA && (
          <p className="mt-2 text-xs text-amber-400">
            Please select two different runs to compare.
          </p>
        )}
      </div>

      {/* ── Comparison Results ──────────────────────────── */}
      {comparing && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}

      {comparison && !comparing && (
        <>
          {/* ── Delta Cards ────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            <ComparisonCard
              label="Health Score"
              icon={TrendingUp}
              iconColor="text-green-400"
              delta={comparison.health_delta}
              runAValue={comparison.runA.health_score}
              runBValue={comparison.runB.health_score}
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
              label="Resolution Rate"
              icon={CheckCircle2}
              iconColor="text-blue-400"
              delta={comparison.resolution_rate_delta}
              suffix="%"
              runAValue={`${comparison.resolution_rate_a}%`}
              runBValue={`${comparison.resolution_rate_b}%`}
            />
            <div className="glass-card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-purple-400" />
                <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
                  Findings Flow
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <div>
                    <span className="text-lg font-bold text-red-400 tabular-nums">
                      {comparison.new_findings}
                    </span>
                    <p className="text-[10px] text-text-muted">New</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <div>
                    <span className="text-lg font-bold text-green-400 tabular-nums">
                      {comparison.findings_resolved}
                    </span>
                    <p className="text-[10px] text-text-muted">Resolved</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Category Breakdown ─────────────────────────── */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-text-primary">
                Category Breakdown
              </h2>
              <div className="ml-auto flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-6 rounded-full bg-blue-500" />
                  {comparison.runA.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-6 rounded-full bg-cyan-500" />
                  {comparison.runB.label}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {/* Merge categories from both runs */}
              {(() => {
                const allCategories = new Set([
                  ...comparison.runA.categories.map((c) => c.name),
                  ...comparison.runB.categories.map((c) => c.name),
                ]);
                return Array.from(allCategories).map((name) => {
                  const catA = comparison.runA.categories.find((c) => c.name === name);
                  const catB = comparison.runB.categories.find((c) => c.name === name);
                  return (
                    <CategoryBar
                      key={name}
                      name={name}
                      countA={catA?.count ?? 0}
                      countB={catB?.count ?? 0}
                      maxCount={maxCategoryCount}
                    />
                  );
                });
              })()}
            </div>
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
                      {run.health_score}
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
                      {run.resolved}
                    </p>
                    <p className="text-[10px] text-text-muted">Resolved</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!comparison && !comparing && !error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="rounded-2xl bg-white/5 p-6">
            <GitCompare className="h-10 w-10 text-text-muted" />
          </div>
          <p className="text-sm text-text-muted">
            Select two analysis runs above to see their comparison
          </p>
        </div>
      )}
    </div>
  );
}
