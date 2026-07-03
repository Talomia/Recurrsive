"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Filter, ArrowRight, CheckCircle2, AlertCircle, TrendingUp, Shield, Zap, ExternalLink } from "lucide-react";
import Header from "@/components/header";
import ScoreGauge from "@/components/score-gauge";
import CategoryBadge, { SeverityBadge } from "@/components/category-badge";
import { getOpportunities, type Opportunity } from "@/lib/api";
import clsx from "clsx";

type TabKey = "overview" | "evidence" | "analysis" | "implementation";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "evidence", label: "Evidence" },
  { key: "analysis", label: "Analysis" },
  { key: "implementation", label: "Implementation Plan" },
];

function getMetricColor(label: string, value: number): string {
  if (label === "Risk" || label === "Effort") {
    if (value <= 30) return "text-green-400";
    if (value <= 60) return "text-amber-400";
    return "text-red-400";
  }
  if (value >= 80) return "text-green-400";
  if (value >= 60) return "text-blue-400";
  if (value >= 40) return "text-amber-400";
  return "text-red-400";
}

function getMetricBarColor(label: string, value: number): string {
  if (label === "Risk" || label === "Effort") {
    if (value <= 30) return "bg-green-500";
    if (value <= 60) return "bg-amber-500";
    return "bg-red-500";
  }
  if (value >= 80) return "bg-green-500";
  if (value >= 60) return "bg-blue-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}



const CATEGORY_OPTIONS = ["All Categories", "Security", "Performance", "Cost", "DevOps", "Architecture", "Database", "Reliability", "Frontend"] as const;
const SEVERITY_OPTIONS = ["All Severities", "critical", "high", "medium", "low"] as const;

export default function OpportunitiesPage() {
  const searchParams = useSearchParams();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [categoryFilter, setCategoryFilter] = useState<string>("All Categories");
  const [severityFilter, setSeverityFilter] = useState<string>("All Severities");

  // Fetch from API on mount, falls back to mock data automatically
  useEffect(() => {
    let cancelled = false;
    getOpportunities().then((data) => {
      if (!cancelled) {
        setOpportunities(data);
        if (data.length > 0) setSelectedId(data[0]!.id);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let result = opportunities;

    // Category filter
    if (categoryFilter !== "All Categories") {
      result = result.filter((o) => o.categories.includes(categoryFilter));
    }

    // Severity filter
    if (severityFilter !== "All Severities") {
      result = result.filter((o) => o.severity === severityFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.categories.some((c) => c.toLowerCase().includes(q)) ||
          o.id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [opportunities, search, categoryFilter, severityFilter]);

  const selected = filtered.find((o) => o.id === selectedId) ?? filtered[0];

  if (!selected) {
    return (
      <div className="flex flex-col h-screen">
        <Header
          title="Opportunities"
          subtitle="AI-discovered improvement opportunities across your codebase"
        />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted text-lg">No opportunities found</p>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "Impact", value: selected.impact, icon: TrendingUp },
    { label: "Confidence", value: selected.confidence, icon: Shield },
    { label: "Effort", value: selected.effort, icon: Zap },
    { label: "Risk", value: selected.risk, icon: AlertCircle },
    { label: "ROI", value: selected.roi, icon: CheckCircle2 },
  ];

  return (
    <div className="flex flex-col h-screen">
      <Header
        title="Opportunities"
        subtitle="AI-discovered improvement opportunities across your codebase"
      />

      <div className="flex flex-1 min-h-0">
        {/* ── Left Panel: List ────────────────────────── */}
        <div className="w-[380px] shrink-0 border-r border-border flex flex-col">
          {/* Search + filter */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5 focus-within:border-accent-blue/40 transition-colors">
              <Search className="h-4 w-4 text-text-muted shrink-0" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opportunities…"
                aria-label="Search opportunities"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const idx = CATEGORY_OPTIONS.indexOf(categoryFilter as typeof CATEGORY_OPTIONS[number]);
                  setCategoryFilter(CATEGORY_OPTIONS[(idx + 1) % CATEGORY_OPTIONS.length]!);
                }}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  categoryFilter !== "All Categories"
                    ? "bg-accent-blue/10 border-accent-blue/30 text-blue-400"
                    : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/8"
                )}
              >
                <Filter className="h-3 w-3" />
                {categoryFilter}
              </button>
              <button
                onClick={() => {
                  const idx = SEVERITY_OPTIONS.indexOf(severityFilter as typeof SEVERITY_OPTIONS[number]);
                  setSeverityFilter(SEVERITY_OPTIONS[(idx + 1) % SEVERITY_OPTIONS.length]!);
                }}
                className={clsx(
                  "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  severityFilter !== "All Severities"
                    ? "bg-accent-blue/10 border-accent-blue/30 text-blue-400"
                    : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/8"
                )}
              >
                {severityFilter === "All Severities" ? "All Severities" : severityFilter.charAt(0).toUpperCase() + severityFilter.slice(1)}
              </button>
            </div>
            <p className="text-xs text-text-muted">
              {filtered.length} opportunities found
            </p>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.map((opp) => {
              const active = opp.id === selectedId;
              return (
                <button
                  key={opp.id}
                  onClick={() => {
                    setSelectedId(opp.id);
                    setActiveTab("overview");
                  }}
                  className={clsx(
                    "w-full text-left rounded-xl p-3.5 border transition-all duration-200",
                    active
                      ? "bg-white/8 border-accent-blue/30 shadow-lg shadow-blue-500/5"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          "text-sm font-medium leading-snug line-clamp-2",
                          active ? "text-text-primary" : "text-text-secondary"
                        )}
                      >
                        <Link
                          href={`/opportunities/${encodeURIComponent(opp.id)}`}
                          className="hover:underline hover:text-accent-blue transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {opp.title}
                        </Link>
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {opp.categories.map((cat) => (
                          <CategoryBadge key={cat} category={cat} />
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <SeverityBadge severity={opp.severity} />
                        <span className="text-[10px] text-text-muted">{opp.id}</span>
                      </div>
                    </div>
                    {/* Score */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span
                        className={clsx(
                          "text-xl font-bold tabular-nums",
                          opp.score >= 90
                            ? "text-red-400"
                            : opp.score >= 75
                              ? "text-orange-400"
                              : opp.score >= 60
                                ? "text-amber-400"
                                : "text-blue-400"
                        )}
                      >
                        {opp.score}
                      </span>
                      <div className="h-1 w-8 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={clsx(
                            "h-full rounded-full",
                            opp.score >= 90
                              ? "bg-red-500"
                              : opp.score >= 75
                                ? "bg-orange-500"
                                : "bg-amber-500"
                          )}
                          style={{ width: `${opp.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right Panel: Detail ─────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start gap-2 flex-wrap mb-2">
              {selected.categories.map((cat) => (
                <CategoryBadge key={cat} category={cat} size="md" />
              ))}
              <SeverityBadge severity={selected.severity} />
              <span className="text-xs text-text-muted ml-1 self-center">
                {selected.id}
              </span>
            </div>
            <h2 className="text-xl font-bold text-text-primary leading-snug">
              <Link
                href={`/opportunities/${encodeURIComponent(selected.id)}`}
                className="hover:underline hover:text-accent-blue transition-colors inline-flex items-center gap-2"
              >
                {selected.title}
                <ExternalLink className="h-4 w-4 text-text-muted" />
              </Link>
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {selected.description}
            </p>
          </div>

          {/* Score + Metrics */}
          <div className="flex items-start gap-8 flex-wrap">
            <div className="flex flex-col items-center">
              <ScoreGauge value={selected.score} size={110} label="Score" />
            </div>
            <div className="flex-1 grid grid-cols-5 gap-4 min-w-[300px]">
              {metrics.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 p-3"
                >
                  <Icon className="h-4 w-4 text-text-muted" />
                  <span
                    className={clsx(
                      "text-lg font-bold tabular-nums",
                      getMetricColor(label, value)
                    )}
                  >
                    {value}
                  </span>
                  <span className="text-[10px] text-text-muted font-medium">
                    {label}
                  </span>
                  <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all",
                        getMetricBarColor(label, value)
                      )}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.key
                      ? "border-accent-blue text-accent-blue"
                      : "border-transparent text-text-muted hover:text-text-secondary"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="animate-fade-in-up">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Root Causes */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Root Causes
                  </h4>
                  <div className="space-y-2">
                    {selected.rootCauses.map((cause, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[10px] font-bold text-red-400">
                          {i + 1}
                        </span>
                        <p className="text-sm text-text-secondary">{cause}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Affected Components */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Affected Components
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.affectedComponents.map((comp) => (
                      <span
                        key={comp}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "evidence" && (
              <div className="space-y-3">
                {selected.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-white/[0.02] border border-white/5 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-blue/10 text-blue-400 border border-blue-500/20">
                        {ev.type}
                      </span>
                      <span className="text-xs text-text-muted">{ev.source}</span>
                    </div>
                    <p className="text-sm text-text-secondary">{ev.description}</p>
                    <p className="mt-2 text-xs font-medium text-text-primary">
                      Value:{" "}
                      <span className="text-accent-cyan">{ev.value}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Impact Analysis
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {selected.description}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <p className="text-xs text-text-muted mb-1">
                        Affected Components
                      </p>
                      <p className="text-lg font-bold text-text-primary">
                        {selected.affectedComponents.length}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <p className="text-xs text-text-muted mb-1">
                        Evidence Points
                      </p>
                      <p className="text-lg font-bold text-text-primary">
                        {selected.evidence.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "implementation" && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-4">
                  Recommended Solution
                </h4>
                <div className="space-y-3">
                  {selected.solution.map((step) => (
                    <div
                      key={step.step}
                      className="flex gap-4 rounded-xl bg-white/[0.02] border border-white/5 p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10 text-sm font-bold text-blue-400">
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-text-primary">
                            {step.title}
                          </p>
                          <span className="text-xs text-text-muted">
                            {step.effort}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-muted shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
