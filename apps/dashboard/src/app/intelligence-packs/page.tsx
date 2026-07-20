'use client';
/**
 * Domain Intelligence Packs page.
 *
 * Browse, install, and manage domain-specific intelligence packs.
 * Uses both getIntelligencePacks (detailed pack data) and
 * getMarketplaceExtensions (marketplace metadata) from the API.
 */

import { useState, useEffect } from 'react';
import { Package, Shield, Heart, DollarSign, Container, Brain, Star, Download } from 'lucide-react';
import type { DashboardIntelligencePack } from '@/lib/api';
import { getIntelligencePacks, getMarketplaceExtensions } from '@/lib/api';
import { apiFetch } from '@/lib/api/client';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';

// ─── Icons ───────────────────────────────────────────────────────────────────

const ICON_MAP = { Heart, DollarSign, Container, Brain } as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketplaceMeta {
  /** Average user rating (0–5) as recorded by the marketplace. */
  rating: number;
  ratingCount: number;
  downloads: number;
}

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
  const { toast } = useToast();
  const [packs, setPacks] = useState<DashboardIntelligencePack[]>([]);
  const [marketplaceMeta, setMarketplaceMeta] = useState<Record<string, MarketplaceMeta>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<DashboardIntelligencePack | null>(null);
  const [uninstalling, setUninstalling] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getIntelligencePacks(),
      getMarketplaceExtensions({ category: 'intelligence-pack' }),
    ])
      .then(([packData, mktRes]) => {
        // Build a lookup of marketplace metadata keyed by pack name
        const meta: Record<string, MarketplaceMeta> = {};
        for (const ext of mktRes.data) {
          meta[ext.name] = { rating: ext.rating ?? 0, ratingCount: ext.ratingCount ?? 0, downloads: ext.downloads ?? 0 };
        }
        setMarketplaceMeta(meta);
        setPacks(packData);
        setExpanded(packData[0]?.id ?? null);
      })
      .catch(() => { setError('Failed to load intelligence packs. The API may be unavailable.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Install applies state only on success; on failure we surface an error and
  // do NOT flip the UI (no optimistic fallback that hides failures).
  const installPack = async (pack: DashboardIntelligencePack) => {
    try {
      await apiFetch(`/api/v1/intelligence-packs/${pack.id}/install`, {
        method: 'POST',
        unwrap: false,
      });
      setPacks(prev => prev.map(p => p.id === pack.id ? { ...p, status: 'installed' } : p));
      toast(`${pack.name} installed.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : `Failed to install ${pack.name}.`, 'error');
    }
  };

  const confirmUninstall = async () => {
    if (!uninstallTarget) return;
    const pack = uninstallTarget;
    setUninstalling(true);
    try {
      await apiFetch(`/api/v1/intelligence-packs/${pack.id}/uninstall`, {
        method: 'POST',
        unwrap: false,
      });
      setPacks(prev => prev.map(p => p.id === pack.id ? { ...p, status: 'available' } : p));
      toast(`${pack.name} uninstalled.`, 'info');
      setUninstallTarget(null);
    } catch {
      toast(`Failed to uninstall ${pack.name}.`, 'error');
    } finally {
      setUninstalling(false);
    }
  };

  const handlePackAction = (pack: DashboardIntelligencePack) => {
    if (pack.status === 'installed') setUninstallTarget(pack);
    else void installPack(pack);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Intelligence Packs" subtitle="Domain-specific analyzers, rules, and compliance frameworks" />
        <LoadingSkeleton variant="list" count={3} />
      </div>
    );
  }

  // A real fetch failure — show an error with retry, never a misleading "empty".
  if (error) {
    return (
      <div className="space-y-6">
        <Header title="Intelligence Packs" subtitle="Domain-specific analyzers, rules, and compliance frameworks" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  // Genuinely empty result (request succeeded, no packs available).
  if (packs.length === 0) {
    return (
      <div className="space-y-6">
        <Header title="Intelligence Packs" subtitle="Domain-specific analyzers, rules, and compliance frameworks" />
        <EmptyState
          icon={Package}
          title="No intelligence packs available"
          description="Domain-specific analyzers, rules, and compliance frameworks will appear here when they become available in the marketplace."
          action={{ label: 'Browse Marketplace', href: '/marketplace' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Intelligence Packs" subtitle="Domain-specific analyzers, rules, and compliance frameworks" />

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
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${pack.name} details`}
                className="flex items-center gap-4 p-5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50"
                onClick={() => setExpanded(isExpanded ? null : pack.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(isExpanded ? null : pack.id); } }}
              >
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
                  {marketplaceMeta[`${pack.name} Intelligence Pack`] && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {marketplaceMeta[`${pack.name} Intelligence Pack`].ratingCount > 0
                          ? marketplaceMeta[`${pack.name} Intelligence Pack`].rating.toFixed(1)
                          : 'Not rated'}
                      </span>
                      <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {marketplaceMeta[`${pack.name} Intelligence Pack`].downloads.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-tertiary">{pack.totalRules} rules</span>
                  <button onClick={e => { e.stopPropagation(); handlePackAction(pack); }}
                    aria-label={`${pack.status === 'installed' ? 'Uninstall' : 'Install'} ${pack.name}`}
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

      {/* Uninstall confirmation */}
      <ConfirmDialog
        open={uninstallTarget !== null}
        title="Uninstall pack"
        destructive
        loading={uninstalling}
        confirmLabel="Uninstall"
        message={
          <>
            Uninstall{' '}
            <span className="font-semibold text-text-primary">{uninstallTarget?.name}</span>? Its analyzers and
            rules will no longer run. You can reinstall it later.
          </>
        }
        onConfirm={confirmUninstall}
        onCancel={() => { if (!uninstalling) setUninstallTarget(null); }}
      />
    </div>
  );
}
