'use client';

/**
 * Domain Intelligence Packs page.
 *
 * Browse, install, and manage domain-specific intelligence packs.
 */

import { useState, useEffect } from 'react';
import { Package, Shield, Heart, DollarSign, Container, Brain, Loader2 } from 'lucide-react';
import type { DashboardIntelligencePack } from '@/lib/api';
import { getIntelligencePacks } from '@/lib/api';

// ─── Icons ───────────────────────────────────────────────────────────────────

const ICON_MAP = { Heart, DollarSign, Container, Brain } as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    installed: 'bg-green-500/20 text-green-400 border-green-500/30',
    available: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    updating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${m[status] ?? ''}`}>{status}</span>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function IntelligencePacksPage() {
  const [packs, setPacks] = useState<DashboardIntelligencePack[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getIntelligencePacks();
      setPacks(data);
      setExpanded(data[0]?.id ?? null);
      setLoading(false);
    }
    load();
  }, []);

  const toggleInstall = (id: string) => {
    setPacks(prev => prev.map(p =>
      p.id === id ? { ...p, status: p.status === 'installed' ? 'available' : 'installed' } : p
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Package className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          Intelligence Packs
        </h1>
        <p className="text-sm text-text-secondary mt-1">Domain-specific analyzers, rules, and compliance frameworks.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Total Packs</p>
          <p className="text-2xl font-bold text-text-primary">{packs.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Installed</p>
          <p className="text-2xl font-bold text-green-400">{packs.filter(p => p.status === 'installed').length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Total Rules</p>
          <p className="text-2xl font-bold text-text-primary">{packs.reduce((a, p) => a + p.totalRules, 0)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Frameworks</p>
          <p className="text-2xl font-bold text-text-primary">{new Set(packs.flatMap(p => p.frameworks)).size}</p>
        </div>
      </div>

      {/* Pack Cards */}
      <div className="space-y-4">
        {packs.map(pack => {
          const Icon = ICON_MAP[pack.icon as keyof typeof ICON_MAP] ?? Brain;
          const isExpanded = expanded === pack.id;
          return (
            <div key={pack.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              {/* Card Header */}
              <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : pack.id)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-base)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-text-primary font-semibold">{pack.name}</h3>
                    <span className="text-xs text-text-tertiary">v{pack.version}</span>
                    <StatusBadge status={pack.status as string} />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{pack.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-tertiary">{pack.totalRules} rules</span>
                  <button onClick={e => { e.stopPropagation(); toggleInstall(pack.id); }}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: pack.status === 'installed' ? 'var(--color-base)' : 'var(--color-accent)',
                      color: pack.status === 'installed' ? 'var(--color-text-secondary)' : '#fff',
                      border: '1px solid var(--color-border)',
                    }}>
                    {pack.status === 'installed' ? 'Uninstall' : 'Install'}
                  </button>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Frameworks */}
                  <div>
                    <p className="text-xs text-text-tertiary uppercase mb-2">Frameworks</p>
                    <div className="flex flex-wrap gap-2">
                      {pack.frameworks.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30">
                          <Shield className="w-3 h-3 inline mr-1" />{f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Entity Types */}
                  <div>
                    <p className="text-xs text-text-tertiary uppercase mb-2">Entity Types</p>
                    <div className="flex flex-wrap gap-2">
                      {pack.entityTypes.map(e => (
                        <span key={e} className="px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30">{e}</span>
                      ))}
                    </div>
                  </div>

                  {/* Analyzers */}
                  <div>
                    <p className="text-xs text-text-tertiary uppercase mb-2">Analyzers</p>
                    <div className="space-y-2">
                      {pack.analyzers.map(a => (
                        <div key={a.name} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-text-primary">{a.name}</p>
                            <p className="text-xs text-text-tertiary">{a.description}</p>
                          </div>
                          <span className="text-sm font-bold text-text-primary">{a.ruleCount} rules</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
