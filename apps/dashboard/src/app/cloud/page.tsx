'use client';
/**
 * Recurrsive Cloud page.
 *
 * Benchmarking, learned patterns, partner directory, and managed service tiers.
 */

import { useState, useEffect } from 'react';
import { BarChart3, Users, Award, Rocket, Globe } from 'lucide-react';
import type { CloudBenchmark, CloudLearnedPattern, CloudPartner, CloudServiceTier } from '@/lib/api';
import { getCloudBenchmarks, getCloudPatterns, getCloudPartners, getCloudServices } from '@/lib/api';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const c: Record<string, string> = {
    platinum: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    silver: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c[tier] ?? ''}`}>{tier}</span>;
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CloudPage() {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'patterns' | 'partners' | 'services'>('benchmarks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [benchmarks, setBenchmarks] = useState<CloudBenchmark[]>([]);
  const [patterns, setPatterns] = useState<CloudLearnedPattern[]>([]);
  const [partners, setPartners] = useState<CloudPartner[]>([]);
  const [services, setServices] = useState<CloudServiceTier[]>([]);

  useEffect(() => {
    async function load() {
      const [b, p, pr, s] = await Promise.all([
        getCloudBenchmarks(),
        getCloudPatterns(),
        getCloudPartners(),
        getCloudServices(),
      ]);
      setBenchmarks(b);
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
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">✕</button>
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
      {activeTab === 'benchmarks' && benchmarks.length === 0 && (
        <EmptyState icon={BarChart3} message="No industry benchmark data yet. Benchmarks appear once enough anonymized analyses have been submitted." />
      )}
      {activeTab === 'benchmarks' && benchmarks.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h3 className="text-lg font-semibold text-text-primary">Industry Benchmarking</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-tertiary text-xs uppercase">
                <th className="pb-3">Dimension</th><th className="pb-3">Your Score</th><th className="pb-3">P50</th><th className="pb-3">P75</th><th className="pb-3">P90</th><th className="pb-3">Percentile</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {benchmarks.map(b => (
                  <tr key={b.dimension}>
                    <td className="py-3 text-text-primary font-medium">{b.dimension}</td>
                    <td className="py-3 text-text-primary font-bold">{b.yourScore}</td>
                    <td className="py-3 text-text-secondary">{b.p50}</td>
                    <td className="py-3 text-text-secondary">{b.p75}</td>
                    <td className="py-3 text-text-secondary">{b.p90}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full" style={{ background: 'var(--color-base)' }}>
                          <div className="h-2 rounded-full" style={{ width: `${b.percentile}%`, background: b.percentile >= 80 ? 'rgb(34,197,94)' : b.percentile >= 50 ? 'rgb(234,179,8)' : 'rgb(239,68,68)' }} />
                        </div>
                        <span className="text-xs text-text-secondary">{b.percentile}th</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <th className="pb-3">Pattern</th><th className="pb-3">Category</th><th className="pb-3">Occurrences</th><th className="pb-3">Success Rate</th><th className="pb-3">Last Seen</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {patterns.map(p => (
                  <tr key={p.id}>
                    <td className="py-3 text-text-primary font-medium">{p.name}</td>
                    <td className="py-3"><span className="px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30">{p.category}</span></td>
                    <td className="py-3 text-text-primary font-semibold">{p.occurrences}</td>
                    <td className="py-3"><span className={p.successRate >= 90 ? 'text-green-400' : 'text-yellow-400'}>{p.successRate}%</span></td>
                    <td className="py-3 text-text-secondary">{p.lastSeen}</td>
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
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{p.logo}</span>
                <div>
                  <h4 className="text-text-primary font-semibold">{p.name}</h4>
                  <TierBadge tier={p.tier} />
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-2">{p.specialty}</p>
              <p className="text-xs text-text-tertiary">{p.projects} projects completed</p>
            </div>
          ))}
        </div>
      )}

      {/* Services */}
      {activeTab === 'services' && services.length === 0 && (
        <EmptyState icon={Globe} message="No managed service tiers are available right now." />
      )}
      {activeTab === 'services' && services.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {services.map(s => (
            <div key={s.name} className="rounded-2xl p-6 flex flex-col"
              style={{
                background: 'var(--color-surface)',
                border: s.highlighted ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              }}>
              {s.highlighted && <span className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--color-accent)' }}>Most Popular</span>}
              <h4 className="text-xl font-bold text-text-primary">{s.name}</h4>
              <p className="text-2xl font-bold text-text-primary mt-1 mb-4">{s.price}</p>
              <ul className="space-y-2 flex-1">
                {s.features.map(f => (
                  <li key={f} className="text-sm text-text-secondary flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />{f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-text-tertiary text-center">
                {s.name === 'Enterprise'
                  ? 'Contact your Recurrsive account team for Enterprise onboarding.'
                  : 'Contact your Recurrsive account team to enable this tier.'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
