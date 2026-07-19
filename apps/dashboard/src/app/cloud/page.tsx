'use client';
/**
 * Recurrsive Cloud page.
 *
 * Benchmarking, learned patterns, partner directory, and managed service tiers.
 * Renders the REAL server shapes: the benchmark endpoint returns a single
 * aggregated report object (not per-dimension rows), patterns carry
 * avgImpact/confidence (no "last seen"), partners carry type/status/
 * integration level, and services carry priceRange/sla (no "most popular").
 */

import { useState, useEffect } from 'react';
import { BarChart3, Users, Award, Rocket, Globe } from 'lucide-react';
import type { CloudBenchmarkReport, CloudLearnedPattern, CloudPartner, CloudServiceTier } from '@/lib/api';
import { getCloudBenchmarkReport, getCloudPatterns, getCloudPartners, getCloudServices } from '@/lib/api';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    inactive: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c[status] ?? 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof BarChart3; message: string }) {
  return (
    <div className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <Icon className="w-8 h-8" style={{ color: 'var(--color-text-tertiary)' }} />
      <p className="text-sm text-text-secondary max-w-sm">{message}</p>
    </div>
  );
}

function formatDimension(dim: string): string {
  return dim.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CloudPage() {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'patterns' | 'partners' | 'services'>('benchmarks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CloudBenchmarkReport | null>(null);
  const [patterns, setPatterns] = useState<CloudLearnedPattern[]>([]);
  const [partners, setPartners] = useState<CloudPartner[]>([]);
  const [services, setServices] = useState<CloudServiceTier[]>([]);

  useEffect(() => {
    async function load() {
      const [b, p, pr, s] = await Promise.all([
        getCloudBenchmarkReport(),
        getCloudPatterns(),
        getCloudPartners(),
        getCloudServices(),
      ]);
      setReport(b);
      setPatterns(p);
      setPartners(pr);
      setServices(s);
    }
    load().catch(() => { setError('Failed to load cloud resources.'); }).finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: 'benchmarks' as const, label: 'Benchmarks', icon: BarChart3 },
    { key: 'patterns' as const, label: 'Patterns', icon: Rocket },
    { key: 'partners' as const, label: 'Partners', icon: Users },
    { key: 'services' as const, label: 'Services', icon: Globe },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Recurrsive Cloud" subtitle="Industry benchmarks, collective intelligence, partner ecosystem, and managed services" />
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Recurrsive Cloud" subtitle="Industry benchmarks, collective intelligence, partner ecosystem, and managed services" />

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === t.key ? 'var(--color-accent)' : 'var(--color-surface)',
              color: activeTab === t.key ? '#fff' : 'var(--color-text-secondary)',
              border: `1px solid ${activeTab === t.key ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Benchmarks */}
      {activeTab === 'benchmarks' && !report && !error && (
        <EmptyState icon={BarChart3} message="No industry benchmark data yet. Benchmarks appear once enough anonymized analyses have been submitted." />
      )}
      {activeTab === 'benchmarks' && report && (
        <div className="rounded-2xl p-6 space-y-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h3 className="text-lg font-semibold text-text-primary">Industry Benchmarking</h3>
            </div>
            <p className="text-xs text-text-tertiary">
              Industry: <span className="text-text-secondary">{report.industry}</span>
              {' · '}
              Sample size: <span className="text-text-secondary">{report.sampleSize}</span>
            </p>
          </div>

          {/* Overall-score percentiles */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-2">Overall Score Percentiles</h4>
            {report.percentiles ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([['P25', report.percentiles.p25], ['P50', report.percentiles.p50], ['P75', report.percentiles.p75], ['P90', report.percentiles.p90]] as const).map(([label, value]) => (
                  <div key={label} className="rounded-xl p-4 text-center" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                    <p className="text-xs text-text-tertiary uppercase">{label}</p>
                    <p className="text-xl font-bold text-text-primary">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">
                {report.percentilesNote ?? 'Percentiles suppressed — not enough benchmark entries for meaningful statistics.'}
              </p>
            )}
          </div>

          {/* Dimension averages */}
          {Object.keys(report.dimensionAverages).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">Dimension Averages</h4>
              <div className="space-y-2">
                {Object.entries(report.dimensionAverages).map(([dim, avg]) => (
                  <div key={dim} className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary w-32 shrink-0">{formatDimension(dim)}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-base)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, avg))}%`, background: 'var(--color-accent)' }} />
                    </div>
                    <span className="text-xs text-text-primary font-semibold w-10 text-right tabular-nums">{avg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top improvement areas */}
          {report.topImprovementAreas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">Top Improvement Areas</h4>
              <div className="flex flex-wrap gap-2">
                {report.topImprovementAreas.map(area => (
                  <span key={area} className="px-2 py-0.5 rounded-full text-xs border bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {formatDimension(area)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patterns */}
      {activeTab === 'patterns' && patterns.length === 0 && (
        <EmptyState icon={Award} message="No learned patterns yet. Patterns emerge from aggregated analysis across projects." />
      )}
      {activeTab === 'patterns' && patterns.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h3 className="text-lg font-semibold text-text-primary">Learned Patterns</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-tertiary text-xs uppercase">
                <th className="pb-3">Pattern</th><th className="pb-3">Category</th><th className="pb-3">Occurrences</th><th className="pb-3">Success Rate</th><th className="pb-3">Avg Impact</th><th className="pb-3">Confidence</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {patterns.map(p => (
                  <tr key={p.id} title={p.recommendation}>
                    <td className="py-3 text-text-primary font-medium">{p.name}</td>
                    <td className="py-3"><span className="px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30">{p.category}</span></td>
                    <td className="py-3 text-text-primary font-semibold">{p.occurrences}</td>
                    <td className="py-3"><span className={p.successRate >= 90 ? 'text-green-400' : 'text-yellow-400'}>{p.successRate}%</span></td>
                    <td className="py-3 text-text-secondary">{p.avgImpact > 0 ? `+${p.avgImpact}` : p.avgImpact} health</td>
                    <td className="py-3 text-text-secondary">{Math.round(p.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partners */}
      {activeTab === 'partners' && partners.length === 0 && (
        <EmptyState icon={Users} message="No cloud partners are configured yet." />
      )}
      {activeTab === 'partners' && partners.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {partners.map(p => (
            <div key={p.id} className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-text-primary font-semibold">{p.name}</h4>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-sm text-text-secondary mb-1 capitalize">{p.type}</p>
              <p className="text-xs text-text-tertiary mb-2">Integration level: {p.integration_level}</p>
              {p.supported_services.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.supported_services.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-[10px] border bg-blue-500/10 text-blue-400 border-blue-500/20">{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Services */}
      {activeTab === 'services' && services.length === 0 && (
        <EmptyState icon={Globe} message="No managed service tiers are available right now." />
      )}
      {activeTab === 'services' && services.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map(s => (
            <div key={s.id} className="rounded-2xl p-6 flex flex-col"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}>
              <span className="text-xs font-bold uppercase mb-2 text-text-tertiary">{s.tier}</span>
              <h4 className="text-xl font-bold text-text-primary">{s.name}</h4>
              <p className="text-2xl font-bold text-text-primary mt-1">{s.priceRange}</p>
              <p className="text-xs text-text-tertiary mb-4">{s.sla}</p>
              <p className="text-xs text-text-secondary mb-4">{s.description}</p>
              <ul className="space-y-2 flex-1">
                {s.features.map(f => (
                  <li key={f} className="text-sm text-text-secondary flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />{f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-text-tertiary text-center">
                Contact your Recurrsive account team to enable this tier.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
