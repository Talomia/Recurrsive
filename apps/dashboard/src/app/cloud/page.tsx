'use client';

/**
 * Recurrsive Cloud page.
 *
 * Benchmarking, learned patterns, partner directory, and managed service tiers.
 */

import { useState } from 'react';
import { Cloud, BarChart3, Users, Award, Rocket, Globe } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Benchmark {
  dimension: string;
  yourScore: number;
  p50: number;
  p75: number;
  p90: number;
  percentile: number;
}

interface LearnedPattern {
  id: string;
  name: string;
  category: string;
  occurrences: number;
  successRate: number;
  lastSeen: string;
}

interface Partner {
  id: string;
  name: string;
  tier: 'platinum' | 'gold' | 'silver';
  specialty: string;
  projects: number;
  logo: string;
}

interface ServiceTier {
  name: string;
  price: string;
  features: string[];
  highlighted: boolean;
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

const BENCHMARKS: Benchmark[] = [
  { dimension: 'Security Posture', yourScore: 88, p50: 62, p75: 74, p90: 89, percentile: 89 },
  { dimension: 'Code Quality', yourScore: 76, p50: 58, p75: 70, p90: 83, percentile: 78 },
  { dimension: 'Dependency Health', yourScore: 91, p50: 55, p75: 68, p90: 85, percentile: 94 },
  { dimension: 'Test Coverage', yourScore: 64, p50: 50, p75: 65, p90: 80, percentile: 51 },
  { dimension: 'Operational Readiness', yourScore: 82, p50: 60, p75: 72, p90: 86, percentile: 80 },
];

const PATTERNS: LearnedPattern[] = [
  { id: 'p1', name: 'Retry-with-backoff', category: 'Resilience', occurrences: 342, successRate: 94, lastSeen: '2h ago' },
  { id: 'p2', name: 'Circuit Breaker', category: 'Resilience', occurrences: 218, successRate: 89, lastSeen: '5h ago' },
  { id: 'p3', name: 'Blue-Green Deploy', category: 'Deployment', occurrences: 187, successRate: 97, lastSeen: '1d ago' },
  { id: 'p4', name: 'Canary Release', category: 'Deployment', occurrences: 156, successRate: 91, lastSeen: '3h ago' },
  { id: 'p5', name: 'Secrets Rotation', category: 'Security', occurrences: 134, successRate: 99, lastSeen: '12h ago' },
];

const PARTNERS: Partner[] = [
  { id: 'pr1', name: 'NovaSec', tier: 'platinum', specialty: 'Security Auditing', projects: 48, logo: '🛡️' },
  { id: 'pr2', name: 'ScaleOps', tier: 'gold', specialty: 'Infrastructure', projects: 32, logo: '⚙️' },
  { id: 'pr3', name: 'DataPulse', tier: 'gold', specialty: 'Analytics', projects: 27, logo: '📊' },
  { id: 'pr4', name: 'CloudForge', tier: 'silver', specialty: 'Migration', projects: 15, logo: '☁️' },
];

const SERVICE_TIERS: ServiceTier[] = [
  { name: 'Starter', price: '$0', features: ['5 projects', 'Community support', 'Basic analytics'], highlighted: false },
  { name: 'Pro', price: '$49/mo', features: ['Unlimited projects', 'Priority support', 'Advanced analytics', 'Benchmarking'], highlighted: true },
  { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'SSO / SAML', 'Dedicated CSM', 'SLA guarantee', 'Custom integrations'], highlighted: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const c: Record<string, string> = {
    platinum: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    silver: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c[tier] ?? ''}`}>{tier}</span>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CloudPage() {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'patterns' | 'partners' | 'services'>('benchmarks');

  const tabs = [
    { key: 'benchmarks' as const, label: 'Benchmarks', icon: BarChart3 },
    { key: 'patterns' as const, label: 'Patterns', icon: Rocket },
    { key: 'partners' as const, label: 'Partners', icon: Users },
    { key: 'services' as const, label: 'Services', icon: Globe },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Cloud className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          Recurrsive Cloud
        </h1>
        <p className="text-sm text-text-secondary mt-1">Industry benchmarks, collective intelligence, partner ecosystem, and managed services.</p>
      </div>

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
      {activeTab === 'benchmarks' && (
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
                {BENCHMARKS.map(b => (
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
      {activeTab === 'patterns' && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h3 className="text-lg font-semibold text-text-primary">Learned Patterns</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-tertiary text-xs uppercase">
              <th className="pb-3">Pattern</th><th className="pb-3">Category</th><th className="pb-3">Occurrences</th><th className="pb-3">Success Rate</th><th className="pb-3">Last Seen</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {PATTERNS.map(p => (
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
      )}

      {/* Partners */}
      {activeTab === 'partners' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PARTNERS.map(p => (
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
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SERVICE_TIERS.map(s => (
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
              <button className="mt-4 w-full py-2 rounded-lg text-sm font-medium"
                style={{ background: s.highlighted ? 'var(--color-accent)' : 'var(--color-base)', color: s.highlighted ? '#fff' : 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                {s.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
