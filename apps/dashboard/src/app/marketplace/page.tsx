'use client';
/**
 * Marketplace page with Intelligence Packs tab.
 *
 * Browse extensions, categories, marketplace stats,
 * and manage domain-specific intelligence packs.
 */

import { useState, useEffect } from 'react';
import { Package, Search, Download, Star, Filter, Shield, Heart, DollarSign, Container, Brain } from 'lucide-react';
import { getMarketplaceExtensions, getMarketplaceCategories, getMarketplaceStats } from '@/lib/api/platform';
import { getIntelligencePacks } from '@/lib/api';
import type { DashboardIntelligencePack } from '@/lib/api';
import { apiFetch } from '@/lib/api/client';
import ErrorBanner from '@/components/error-banner';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  downloads: number;
  stars: number;
  verified: boolean;
  price: string;
}

interface Category {
  id: string;
  name: string;
  count: number;
  icon: string;
}

interface MarketplaceStats {
  totalExtensions: number;
  totalDownloads: number;
  totalAuthors: number;
  averageRating: number;
}

interface MarketplaceMeta {
  stars: number;
  downloads: number;
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = ['Extensions', 'Intelligence Packs'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Intelligence Packs helpers
// ---------------------------------------------------------------------------

const ICON_MAP = { Heart, DollarSign, Container, Brain } as const;

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    installed: 'bg-green-500/20 text-green-400 border-green-500/30',
    available: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    updating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${m[status] ?? ''}`}>{status}</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MarketplacePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('Extensions');

  // Extensions state
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Intelligence Packs state
  const [packs, setPacks] = useState<DashboardIntelligencePack[]>([]);
  const [marketplaceMeta, setMarketplaceMeta] = useState<Record<string, MarketplaceMeta>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [packsLoaded, setPacksLoaded] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<DashboardIntelligencePack | null>(null);
  const [uninstalling, setUninstalling] = useState(false);

  // Load extensions
  useEffect(() => {
    async function load() {
      try {
        const [extRes, catRes, stRes] = await Promise.all([
          getMarketplaceExtensions(),
          getMarketplaceCategories(),
          getMarketplaceStats(),
        ]);
        setExtensions((extRes.data ?? []) as Extension[]);
        setCategories((catRes.data ?? []) as Category[]);
        setStats((stRes.data ?? null) as MarketplaceStats | null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load marketplace data');
      }
    }
    load().finally(() => setLoading(false));
  }, []);

  // Lazy load intelligence packs
  useEffect(() => {
    if (activeTab !== 'Intelligence Packs' || packsLoaded) return;
    setPacksLoading(true);
    (async () => {
      try {
        const [packData, mktRes] = await Promise.all([
          getIntelligencePacks(),
          getMarketplaceExtensions({ category: 'intelligence-pack' }),
        ]);
        const meta: Record<string, MarketplaceMeta> = {};
        for (const ext of mktRes.data) {
          meta[ext.name] = { stars: ext.stars ?? 0, downloads: ext.downloads ?? 0, verified: ext.verified ?? false };
        }
        setMarketplaceMeta(meta);
        setPacks(packData);
        setExpanded(packData[0]?.id ?? null);
        setPacksLoaded(true);
      } catch {
        setPacksError('Failed to load intelligence packs. API may be unavailable.');
      } finally {
        setPacksLoading(false);
      }
    })();
  }, [activeTab, packsLoaded]);

  // Install applies state only on success; on failure we toast an error and do
  // NOT flip the UI (no optimistic fallback that hides failures).
  const installPack = async (pack: DashboardIntelligencePack) => {
    try {
      await apiFetch(`/api/v1/intelligence-packs/${pack.id}/install`, {
        method: 'POST',
        unwrap: false,
      });
      setPacks(prev => prev.map(p => p.id === pack.id ? { ...p, status: 'installed' } : p));
      toast(`${pack.name} installed.`, 'success');
    } catch {
      toast(`Failed to install ${pack.name}.`, 'error');
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

  const filtered = extensions.filter((ext) => {
    const matchesSearch =
      ext.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || ext.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Marketplace" subtitle="Discover and install extensions to enhance your Recurrsive experience" />
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Marketplace" subtitle="Discover and install extensions to enhance your Recurrsive experience" />

      {/* Tabs */}
      <div
        className="flex items-center gap-1 border-b border-white/10"
        role="tablist"
        aria-label="Marketplace sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Extensions Tab */}
      {activeTab === 'Extensions' && (
        <div role="tabpanel" aria-label="Extensions" className="space-y-6">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Extensions', value: stats.totalExtensions },
                { label: 'Downloads', value: stats.totalDownloads.toLocaleString() },
                { label: 'Authors', value: stats.totalAuthors },
                { label: 'Avg Rating', value: `${stats.averageRating.toFixed(1)} ★` },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl p-4 text-center"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <p className="text-2xl font-bold text-text-primary">{s.value}</p>
                  <p className="text-xs text-text-tertiary mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterCategory('all')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: filterCategory === 'all' ? 'var(--color-accent)' : 'var(--color-base)',
                    color: filterCategory === 'all' ? '#fff' : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.name)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: filterCategory === cat.name ? 'var(--color-accent)' : 'var(--color-base)',
                      color: filterCategory === cat.name ? '#fff' : 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Browse Extensions */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
              Browse Extensions
            </h3>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                placeholder="Search extensions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-base)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
              />
            </div>

            {/* Extension Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((ext) => (
                <div
                  key={ext.id}
                  className="rounded-xl p-4 flex flex-col"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-text-primary">{ext.name}</span>
                    {ext.verified && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary flex-1 mb-3">{ext.description}</p>
                  <div className="flex items-center gap-3 text-xs text-text-tertiary mb-3">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" /> {ext.stars}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" /> {ext.downloads.toLocaleString()}
                    </span>
                    <span>v{ext.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">by {ext.author}</span>
                    <span className="text-xs font-semibold text-text-primary">{ext.price}</span>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-8">
                No extensions found matching your search.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Intelligence Packs Tab */}
      {activeTab === 'Intelligence Packs' && (
        <div role="tabpanel" aria-label="Intelligence Packs" className="space-y-6">
          {packsLoading && <LoadingSkeleton variant="list" count={3} />}

          {packsError && <ErrorBanner message={packsError} onDismiss={() => setPacksError(null)} />}

          {!packsLoading && packsLoaded && (
            <>
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
                            {marketplaceMeta[`${pack.name} Intelligence Pack`]?.verified && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">✓ Verified</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">{pack.description}</p>
                          {marketplaceMeta[`${pack.name} Intelligence Pack`] && (
                            <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                              <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {marketplaceMeta[`${pack.name} Intelligence Pack`].stars}</span>
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
            </>
          )}
        </div>
      )}

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
