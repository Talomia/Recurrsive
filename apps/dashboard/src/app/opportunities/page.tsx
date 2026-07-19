"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Filter, AlertCircle, Shield, Zap, ExternalLink, Lightbulb, Download, Wrench, Layers } from "lucide-react";
import Header from "@/components/header";
import ScoreGauge from "@/components/score-gauge";
import CategoryBadge, { SeverityBadge } from "@/components/category-badge";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import LoadingSkeleton from "@/components/loading-skeleton";
import { getOpportunities, type Opportunity } from "@/lib/api";
import { scopedHref } from "@/lib/project-links";
import { downloadCsv } from "@/lib/csv";
import clsx from "clsx";

type TabKey = "overview" | "evidence" | "analysis" | "implementation";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "evidence", label: "Evidence" },
  { key: "analysis", label: "Impact Analysis" },
  { key: "implementation", label: "Implementation Plan" },
];

// ─── Real-metric display helpers ─────────────────────────────────────────────

/** Confidence is 0–1 from the server; render as a percentage. */
function formatConfidence(confidence: number | null): string {
  return confidence == null ? "—" : `${Math.round(confidence * 100)}%`;
}

function confidenceColor(confidence: number | null): string {
  if (confidence == null) return "text-text-muted";
  if (confidence >= 0.8) return "text-green-400";
  if (confidence >= 0.6) return "text-blue-400";
  if (confidence >= 0.4) return "text-amber-400";
  return "text-red-400";
}

/** Effort is a t-shirt size (+ optional hour estimate) — never a made-up number. */
function formatEffort(effort: Opportunity["effort"]): string {
  if (!effort) return "—";
  const size = effort.tShirt.toUpperCase();
  return effort.estimatedHours != null ? `${size} · ${effort.estimatedHours}h` : size;
}

function effortColor(effort: Opportunity["effort"]): string {
  if (!effort) return "text-text-muted";
  const t = effort.tShirt.toLowerCase();
  if (t === "xs" || t === "s") return "text-green-400";
  if (t === "m") return "text-amber-400";
  return "text-red-400";
}

function riskColor(level: string | null): string {
  switch (level) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-amber-400";
    case "low": return "text-green-400";
    case "negligible": return "text-green-400";
    default: return "text-text-muted";
  }
}

function formatMetricValue(v: string | number | null): string {
  return v == null ? "—" : String(v);
}

const CATEGORY_OPTIONS = ["All Categories", "security", "performance", "cost", "architecture", "reliability", "developer_experience", "documentation", "infrastructure"] as const;
const SEVERITY_OPTIONS = ["All Severities", "critical", "high", "medium", "low", "info"] as const;

export default function OpportunitiesPage() {
  const searchParams = useSearchParams();
  // Key the fetch on the active project so switching projects (a query-string
  // change) actually refetches instead of showing the previous project's data.
  const projectId = searchParams.get("projectId");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [categoryFilter, setCategoryFilter] = useState<string>("All Categories");
  const [severityFilter, setSeverityFilter] = useState<string>("All Severities");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch opportunities from API, re-running when the active project changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOpportunities()
      .then((data) => {
        if (!cancelled) {
          setOpportunities(data);
          if (data.length > 0) setSelectedId(data[0]!.id);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load opportunities. The analysis server may be unreachable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId, reloadKey]);

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

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <Header
          title="Opportunities"
          subtitle="AI-discovered improvement opportunities across your codebase"
        />
        <div className="flex-1 p-6">
          <LoadingSkeleton variant="list" count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen">
        <Header
          title="Opportunities"
          subtitle="Couldn't load opportunities"
        />
        <ErrorState
          title="Failed to load opportunities"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex flex-col h-screen">
        <Header
          title="Opportunities"
          subtitle="AI-discovered improvement opportunities across your codebase"
        />
        {opportunities.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No opportunities yet"
            description="Run an analysis on your project to discover improvement opportunities across security, performance, cost, and architecture."
            action={{ label: 'Go to Projects', href: '/projects' }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-2">
            <p className="text-text-muted text-lg">No opportunities match your filters</p>
          </div>
        )}
      </div>
    );
  }

  // Real server-provided facts only — no synthetic impact/ROI numbers.
  const metrics = [
    { label: "Confidence", value: formatConfidence(selected.confidence), color: confidenceColor(selected.confidence), icon: Shield },
    { label: "Effort", value: formatEffort(selected.effort), color: effortColor(selected.effort), icon: Zap },
    { label: "Risk", value: selected.riskLevel ?? "—", color: riskColor(selected.riskLevel), icon: AlertCircle },
  ];

  // Export exactly what's on screen (respects active filters) — real data only.
  const exportCsv = () => {
    downloadCsv(
      'opportunities.csv',
      ['ID', 'Title', 'Severity', 'Status', 'Categories', 'Confidence', 'Effort', 'Risk'],
      filtered.map((o) => [
        o.id, o.title, o.severity, o.status, o.categories.join('; '),
        o.confidence == null ? '' : o.confidence,
        o.effort?.tShirt ?? '',
        o.riskLevel ?? '',
      ]),
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <Header
        title="Opportunities"
        subtitle="AI-discovered improvement opportunities across your codebase"
        primaryAction={{
          label: 'Export CSV',
          onClick: exportCsv,
          icon: Download,
          disabled: filtered.length === 0,
        }}
      />

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* ── Left Panel: List ────────────────────────── */}
        <div className="w-full lg:w-[380px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col max-h-[45vh] lg:max-h-none">
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
                          href={scopedHref(`/opportunities/${encodeURIComponent(opp.id)}`, projectId)}
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
                        <span className="text-[10px] text-text-muted">
                          Confidence {formatConfidence(opp.confidence)}
                        </span>
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
                href={scopedHref(`/opportunities/${encodeURIComponent(selected.id)}`, projectId)}
                className="hover:underline hover:text-accent-blue transition-colors inline-flex items-center gap-2"
              >
                {selected.title}
                <ExternalLink className="h-4 w-4 text-text-muted" />
              </Link>
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {selected.problem}
            </p>
          </div>

          {/* Score (only when the server computed one) + real metrics */}
          <div className="flex items-start gap-8 flex-wrap">
            {selected.score != null && (
              <div className="flex flex-col items-center">
                <ScoreGauge value={Math.round(selected.score * 100)} size={110} label="Score" />
              </div>
            )}
            <div className="flex-1 grid grid-cols-3 gap-4 min-w-[300px]">
              {metrics.map(({ label, value, color, icon: Icon }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 p-3"
                >
                  <Icon className="h-4 w-4 text-text-muted" />
                  <span className={clsx("text-lg font-bold tabular-nums capitalize", color)}>
                    {value}
                  </span>
                  <span className="text-[10px] text-text-muted font-medium">
                    {label}
                  </span>
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
                {/* Problem */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Problem
                  </h4>
                  {selected.problem ? (
                    <p className="text-sm text-text-secondary leading-relaxed rounded-lg bg-white/[0.02] border border-white/5 p-3">
                      {selected.problem}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted italic">No problem statement provided.</p>
                  )}
                </div>

                {/* Recommendation */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Recommendation
                  </h4>
                  {selected.recommendation ? (
                    <p className="text-sm text-text-secondary leading-relaxed rounded-lg bg-white/[0.02] border border-white/5 p-3">
                      {selected.recommendation}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted italic">No recommendation provided.</p>
                  )}
                </div>

                {/* Affected Services */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Affected Services
                  </h4>
                  {selected.affectedServices.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.affectedServices.map((svc) => (
                        <span
                          key={svc}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
                          {svc}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic">No affected services identified.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "evidence" && (
              <div className="space-y-3">
                {selected.evidence.length === 0 && (
                  <p className="text-xs text-text-muted italic">No evidence collected for this opportunity.</p>
                )}
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
                      Confidence:{" "}
                      <span className="text-accent-cyan">{formatConfidence(ev.confidence)}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Expected Impact
                  </h4>
                  {selected.impactSummary ? (
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {selected.impactSummary}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted italic">No impact summary provided.</p>
                  )}

                  {selected.impactMetrics.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {selected.impactMetrics.map((m, i) => (
                        <div key={i} className="rounded-lg bg-white/[0.03] p-3 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-xs font-medium text-text-primary">{m.name}</p>
                            {m.isEstimate && (
                              <span className="text-[10px] text-amber-400">estimate — not a measured value</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary tabular-nums">
                            {formatMetricValue(m.currentValue)} → {formatMetricValue(m.expectedValue)}
                            {m.changePercent != null && (
                              <span className="ml-2 text-text-muted">({m.changePercent > 0 ? "+" : ""}{m.changePercent}%)</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <p className="text-xs text-text-muted mb-1">
                        Affected Services
                      </p>
                      <p className="text-lg font-bold text-text-primary">
                        {selected.affectedServices.length}
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
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">
                    Recommended Solution
                  </h4>
                  {selected.recommendation ? (
                    <div className="flex gap-4 rounded-xl bg-white/[0.02] border border-white/5 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10">
                        <Wrench className="h-4 w-4 text-blue-400" />
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {selected.recommendation}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic">No recommendation provided.</p>
                  )}
                </div>

                {selected.effort && (
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-3">
                      Effort Estimate
                    </h4>
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-2">
                      <p className="text-sm text-text-secondary">
                        Size: <span className={clsx("font-bold", effortColor(selected.effort))}>{selected.effort.tShirt.toUpperCase()}</span>
                        {selected.effort.estimatedHours != null && (
                          <span className="ml-3">≈ {selected.effort.estimatedHours} engineering hours</span>
                        )}
                        {selected.effort.estimatedDays != null && (
                          <span className="ml-3">≈ {selected.effort.estimatedDays} calendar days</span>
                        )}
                      </p>
                      {selected.effort.skillsRequired.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-text-muted" />
                          {selected.effort.skillsRequired.map((s) => (
                            <span key={s} className="rounded-lg bg-white/5 border border-white/5 px-2 py-0.5 text-xs text-text-secondary">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected.riskLevel && (
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-3">
                      Implementation Risk
                    </h4>
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                      <p className={clsx("text-sm font-bold capitalize", riskColor(selected.riskLevel))}>
                        {selected.riskLevel}
                      </p>
                      {selected.riskDescription && (
                        <p className="mt-1 text-xs text-text-secondary leading-relaxed">{selected.riskDescription}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
