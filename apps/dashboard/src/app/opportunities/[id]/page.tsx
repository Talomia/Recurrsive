import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  Shield,
  Zap,
  AlertCircle,
  CheckCircle2,
  FileText,
  Target,
  Layers,
  ArrowRight,
} from "lucide-react";
import Header from "@/components/header";
import { getOpportunity } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { scopedHref } from "@/lib/project-links";
import OpportunityActions from "./opportunity-actions";

// ---------------------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------------------

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

function getSeverityStyle(severity: string) {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    critical: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
    high: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    low: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  };
  return styles[severity] ?? styles.medium!;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-red-400";
  if (score >= 75) return "text-orange-400";
  if (score >= 60) return "text-amber-400";
  return "text-blue-400";
}

function getScoreBarColor(score: number): string {
  if (score >= 90) return "bg-red-500";
  if (score >= 75) return "bg-orange-500";
  return "bg-amber-500";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface OpportunityDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}

export default async function OpportunityDetailPage({ params, searchParams }: OpportunityDetailPageProps) {
  const { id } = await params;
  const { projectId } = await searchParams;
  const opportunity = await getOpportunity(id);

  const listHref = scopedHref("/opportunities", projectId ?? null);

  if (!opportunity) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Opportunity Detail"
          breadcrumbs={[{ label: "Opportunities", href: listHref }, { label: `#${id}` }]}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="rounded-2xl bg-white/5 p-6">
            <AlertCircle className="h-10 w-10 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            Opportunity Not Found
          </h2>
          <p className="text-sm text-text-muted max-w-xs text-center">
            The opportunity <span className="text-text-secondary font-mono">{id}</span> could
            not be found. It may have been resolved or removed.
          </p>
          <Link
            href={listHref}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Opportunities
          </Link>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "Impact", value: opportunity.impact, icon: TrendingUp },
    { label: "Confidence", value: opportunity.confidence, icon: Shield },
    { label: "Effort", value: opportunity.effort, icon: Zap },
    { label: "Risk", value: opportunity.risk, icon: AlertCircle },
    { label: "ROI", value: opportunity.roi, icon: CheckCircle2 },
  ];

  const sev = getSeverityStyle(opportunity.severity);

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Consistent page shell: breadcrumb back to the list ─────────── */}
      <Header
        title={opportunity.title}
        subtitle={`${opportunity.categories.join(" · ")} · ${opportunity.severity}`}
        breadcrumbs={[{ label: "Opportunities", href: listHref }, { label: `#${opportunity.id}` }]}
      />

      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full animate-fade-in-up">
      {/* ── Summary card ───────────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {opportunity.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-accent-blue/10 text-blue-400 border border-blue-500/20"
                >
                  {cat}
                </span>
              ))}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sev.bg} ${sev.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                {opportunity.severity}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-text-primary leading-snug">
              {opportunity.title}
            </h2>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-3xl">
              {opportunity.description}
            </p>
          </div>

          {/* Overall Score */}
          <div className="shrink-0 flex flex-col items-center gap-1 rounded-2xl bg-white/[0.03] border border-white/5 p-4 min-w-[100px]">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
              Score
            </span>
            <span className={`text-3xl font-bold tabular-nums ${getScoreColor(opportunity.score)}`}>
              {opportunity.score}
            </span>
            <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreBarColor(opportunity.score)}`}
                style={{ width: `${opportunity.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Date info ───────────────────────────────── */}
        <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-white/5">
          <span>
            Discovered: {formatDate(opportunity.createdAt)}
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>ID: {opportunity.id}</span>
        </div>
      </div>

      {/* ── Metrics Grid ────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors"
          >
            <Icon className="h-4 w-4 text-text-muted" />
            <span
              className={`text-xl font-bold tabular-nums ${getMetricColor(label, value)}`}
            >
              {value}
            </span>
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
              {label}
            </span>
            <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getMetricBarColor(label, value)}`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout: Root Causes + Evidence ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Root Causes */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-text-primary">Root Causes</h2>
          </div>
          <div className="space-y-2">
            {opportunity.rootCauses.length > 0 ? (
              opportunity.rootCauses.map((cause, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[10px] font-bold text-red-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-text-secondary">{cause}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted italic">No root causes identified yet.</p>
            )}
          </div>
        </div>

        {/* Evidence */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-text-primary">Evidence</h2>
            <span className="ml-auto text-xs text-text-muted">
              {opportunity.evidence.length} item{opportunity.evidence.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {opportunity.evidence.length > 0 ? (
              opportunity.evidence.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/[0.02] border border-white/5 p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/10 text-blue-400 border border-blue-500/20">
                      {ev.type}
                    </span>
                    <span className="text-[10px] text-text-muted truncate">{ev.source}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{ev.description}</p>
                  {ev.value && (
                    <p className="mt-1.5 text-[10px] font-medium text-text-primary">
                      Value: <span className="text-accent-cyan">{ev.value}</span>
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted italic">No evidence collected yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Affected Components ──────────────────────── */}
      {opportunity.affectedComponents.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-text-primary">Affected Components</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {opportunity.affectedComponents.map((comp) => (
              <span
                key={comp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/8 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Implementation Plan ──────────────────────── */}
      {opportunity.solution.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Recommended Solution
          </h2>
          <div className="space-y-3">
            {opportunity.solution.map((step) => (
              <div
                key={step.step}
                className="flex gap-4 rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10 text-sm font-bold text-blue-400">
                  {step.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary">{step.title}</p>
                    <span className="text-xs text-text-muted whitespace-nowrap">{step.effort}</span>
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

      {/* ── Action Buttons ───────────────────────────── */}
      <OpportunityActions opportunityId={opportunity.id} />
      </div>
    </div>
  );
}
