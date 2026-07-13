/**
 * @module Executive Intelligence Dashboard
 *
 * High-level intelligence summary designed for engineering leadership.
 * Provides at-a-glance KPIs, trend sparklines, risk assessment, and
 * strategic recommendations — all without technical detail overload.
 *
 * @packageDocumentation
 */

'use client';

import Header from '@/components/header';
import { useEffect, useState } from 'react';
import {
  getHealthMetrics,
  getTimeline,
  getOpportunities,
  getFindingsSummary,
  type HealthMetrics,
  type TimelinePoint,
  type Opportunity,
  type FindingsSummary,
} from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExecutiveData {
  health: HealthMetrics | null;
  timeline: TimelinePoint[];
  opportunities: Opportunity[];
  findingsSummary: FindingsSummary | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a number as a percentage string. */
function pct(n: number): string {
  return `${Math.round(n)}%`;
}

/** Get trend indicator and color. */
function trendInfo(n: number): { icon: string; color: string; label: string } {
  if (n > 0) return { icon: '↑', color: '#22c55e', label: `+${n.toFixed(1)}%` };
  if (n < 0) return { icon: '↓', color: '#ef4444', label: `${n.toFixed(1)}%` };
  return { icon: '→', color: '#6b7280', label: '0%' };
}

/** Map severity to color. */
function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low': return '#22c55e';
    default: return '#6b7280';
  }
}

/** Priority score for sorting opportunities. */
function priorityScore(opp: Opportunity): number {
  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return (severityWeight[opp.severity] ?? 1) * opp.confidence;
}

// ─── Components ──────────────────────────────────────────────────────────────

function KPICard({
  title,
  value,
  trend,
  icon,
  gradient,
}: {
  title: string;
  value: string;
  trend?: number;
  icon: string;
  gradient: string;
}) {
  const t = trend !== undefined ? trendInfo(trend) : null;
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden"
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10"
           style={{ background: gradient }} />
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-text-primary">{value}</span>
        {t && (
          <span className="text-sm font-medium mb-1" style={{ color: t.color }}>
            {t.icon} {t.label}
          </span>
        )}
      </div>
    </div>
  );
}

function RiskIndicator({ level, label }: { level: 'low' | 'medium' | 'high' | 'critical'; label: string }) {
  const colors: Record<string, { bg: string; bar: string; text: string }> = {
    low: { bg: 'rgba(34, 197, 94, 0.1)', bar: '#22c55e', text: '#86efac' },
    medium: { bg: 'rgba(234, 179, 8, 0.1)', bar: '#eab308', text: '#fde047' },
    high: { bg: 'rgba(249, 115, 22, 0.1)', bar: '#f97316', text: '#fdba74' },
    critical: { bg: 'rgba(239, 68, 68, 0.1)', bar: '#ef4444', text: '#fca5a5' },
  };
  const c = colors[level] ?? colors.medium;
  const fillPct = level === 'low' ? 25 : level === 'medium' ? 50 : level === 'high' ? 75 : 100;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: c.bg }}>
      <div className="flex-1">
        <span className="text-sm font-medium" style={{ color: c.text }}>{label}</span>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fillPct}%`, background: c.bar }} />
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.bar }}>
        {level}
      </span>
    </div>
  );
}

function StrategicRecommendation({
  title,
  description,
  severity,
  effort,
}: {
  title: string;
  description: string;
  severity: Opportunity['severity'];
  effort: Opportunity['effort'];
}) {
  const severityColors: Record<Opportunity['severity'], string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6b7280',
  };

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
      <h4 className="text-sm font-semibold text-text-primary mb-1">{title}</h4>
      <p className="text-xs text-text-secondary mb-3">{description}</p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Severity</span>
          <span className="text-[10px] font-bold uppercase" style={{ color: severityColors[severity] }}>{severity}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Effort</span>
          <span className="text-[10px] font-bold uppercase text-text-secondary">{effort === 'unknown' ? 'Not estimated' : effort}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExecutivePage() {
  const [data, setData] = useState<ExecutiveData>({
    health: null,
    timeline: [],
    opportunities: [],
    findingsSummary: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [health, timeline, opportunities, findingsSummary] = await Promise.all([
        getHealthMetrics().catch(() => null),
        getTimeline().catch(() => []),
        getOpportunities().catch(() => []),
        getFindingsSummary().catch(() => null),
      ]);
      setData({ health, timeline, opportunities, findingsSummary });
      setLoading(false);
    }
    load();
  }, []);

  // Derived metrics
  const topOpportunities = [...data.opportunities]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 5);

  const criticalCount = data.findingsSummary?.by_severity?.critical ?? 0;
  const highCount = data.findingsSummary?.by_severity?.high ?? 0;
  const totalFindings = data.findingsSummary?.total ?? 0;

  const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
    criticalCount > 0 ? 'critical'
    : highCount > 5 ? 'high'
    : highCount > 0 ? 'medium'
    : 'low';

  return (
    <>
      <Header
        title="Executive Intelligence"
        subtitle="Strategic engineering health overview for leadership"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                 style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="System Health"
                value={data.health ? pct(data.health.healthScore) : '—'}
                trend={data.health?.healthTrend}
                icon="💚"
                gradient="linear-gradient(135deg, #22c55e, #16a34a)"
              />
              <KPICard
                title="Documentation"
                value={data.health ? pct(data.health.documentationScore) : '—'}
                icon="⚡"
                gradient="linear-gradient(135deg, #3b82f6, #2563eb)"
              />
              <KPICard
                title="Security"
                value={data.health ? pct(data.health.securityScore) : '—'}
                icon="🛡️"
                gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)"
              />
              <KPICard
                title="Open Findings"
                value={data.health ? String(data.health.findingCount) : '—'}
                icon="🔎"
                gradient="linear-gradient(135deg, #f97316, #ea580c)"
              />
            </div>

            {/* Risk Assessment + Strategic Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk Panel */}
              <div className="rounded-2xl p-6"
                   style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-sm font-semibold text-text-primary mb-4">Risk Assessment</h3>
                <div className="space-y-3">
                  <RiskIndicator level={riskLevel} label="Overall Risk Level" />
                  <RiskIndicator
                    level={criticalCount > 0 ? 'critical' : 'low'}
                    label={`Security (${criticalCount} critical)`}
                  />
                  <RiskIndicator
                    level={highCount > 3 ? 'high' : highCount > 0 ? 'medium' : 'low'}
                    label={`Reliability (${highCount} high findings)`}
                  />
                  <RiskIndicator
                    level={data.health && data.health.findingCount > 40 ? 'high' : data.health && data.health.findingCount > 0 ? 'medium' : 'low'}
                    label={`Open Findings (${data.health?.findingCount ?? 0})`}
                  />
                </div>

                {/* Summary stats */}
                <div className="mt-4 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary">{totalFindings}</p>
                    <p className="text-[10px] text-text-tertiary uppercase">Total Findings</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary">{data.opportunities.length}</p>
                    <p className="text-[10px] text-text-tertiary uppercase">Opportunities</p>
                  </div>
                </div>
              </div>

              {/* Strategic Recommendations */}
              <div className="lg:col-span-2 rounded-2xl p-6"
                   style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  Strategic Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {topOpportunities.length > 0 ? (
                    topOpportunities.map((opp) => (
                      <StrategicRecommendation
                        key={opp.id}
                        title={opp.title}
                        description={(opp.description ?? 'No description').slice(0, 120) + '...'}
                        severity={opp.severity}
                        effort={opp.effort}
                      />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8">
                      <p className="text-sm text-text-secondary">No strategic recommendations available yet.</p>
                      <p className="text-xs text-text-tertiary mt-1">Run an analysis to generate intelligence.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Findings Breakdown */}
            <div className="rounded-2xl p-6"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-4">Findings Severity Distribution</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                  const count = data.findingsSummary?.by_severity?.[severity] ?? 0;
                  const pctVal = totalFindings > 0 ? (count / totalFindings) * 100 : 0;
                  return (
                    <div key={severity} className="rounded-xl p-4" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: severityColor(severity) }} />
                        <span className="text-xs font-semibold uppercase text-text-secondary">{severity}</span>
                      </div>
                      <p className="text-2xl font-bold text-text-primary">{count}</p>
                      <div className="mt-2 h-1 w-full rounded-full bg-white/5">
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${pctVal}%`, background: severityColor(severity) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline mini-chart (text-based) */}
            {data.timeline.length > 0 && (
              <div className="rounded-2xl p-6"
                   style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-sm font-semibold text-text-primary mb-4">Health Score Trend</h3>
                <div className="flex items-end gap-1 h-20">
                  {data.timeline.slice(-30).map((point, i) => {
                    const height = Math.max(4, (point.healthScore / 100) * 80);
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all duration-300"
                        style={{
                          height: `${height}px`,
                          background: point.healthScore >= 70
                            ? 'linear-gradient(to top, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.8))'
                            : point.healthScore >= 40
                              ? 'linear-gradient(to top, rgba(234, 179, 8, 0.4), rgba(234, 179, 8, 0.8))'
                              : 'linear-gradient(to top, rgba(239, 68, 68, 0.4), rgba(239, 68, 68, 0.8))',
                          minWidth: '4px',
                        }}
                        title={`${point.date}: ${point.healthScore}%`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-text-tertiary">
                    {data.timeline[data.timeline.length - 30]?.date ?? data.timeline[0]?.date}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    {data.timeline[data.timeline.length - 1]?.date}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
