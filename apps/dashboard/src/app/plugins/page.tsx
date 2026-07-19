'use client';
/**
 * Plugin Marketplace page.
 *
 * Lists installed plugins, marketplace plugins, health indicators, and SDK info.
 * Fetches data from both legacy plugin endpoints and the new marketplace extensions API.
 */

import { useState, useEffect } from 'react';
import { Package, Download, Power, Shield, Star, Search, Trash2 } from 'lucide-react';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import EmptyState from '@/components/ui/empty-state';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import {
  getInstalledPlugins,
  getMarketplacePlugins,
  getMarketplaceExtensions,
  installPlugin as apiInstallPlugin,
  uninstallPlugin as apiUninstallPlugin,
  togglePlugin as apiTogglePlugin,
} from '@/lib/api';
import type { InstalledPlugin, MarketplacePlugin } from '@/lib/api';
function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function HealthDot({ health }: { health: string }) {
  const color = health === 'healthy' ? 'bg-green-400' : health === 'degraded' ? 'bg-yellow-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    analyzer: 'bg-blue-500/20 text-blue-400',
    collector: 'bg-cyan-500/20 text-cyan-400',
    reporter: 'bg-purple-500/20 text-purple-400',
    integration: 'bg-orange-500/20 text-orange-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] ?? 'bg-gray-500/20 text-gray-400'}`}>{type}</span>;
}

export default function PluginsPage() {
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplacePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<InstalledPlugin | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      // Fetch from both legacy plugin endpoints and new marketplace extensions API
      const [inst, mkt, mktExt] = await Promise.all([
        getInstalledPlugins(),
        getMarketplacePlugins(),
        getMarketplaceExtensions(),
      ]);

      setInstalled(inst);

      // Merge marketplace data: start with legacy plugins, then add any new
      // extensions from the marketplace API that aren't already present
      const existingIds = new Set(mkt.map(p => p.id));
      const extraPlugins: MarketplacePlugin[] = mktExt.data
        .filter(ext => !existingIds.has(ext.id) && ext.category !== 'intelligence-pack')
        .map(ext => ({
          id: ext.id,
          name: ext.name,
          version: ext.version ?? '1.0.0',
          author: ext.author ?? 'Unknown',
          description: ext.description ?? '',
          // Server field is `rating` (0–5 average) — there is no `stars`.
          rating: ext.rating ?? 0,
          downloads: ext.downloads ?? 0,
          type: (ext.category as MarketplacePlugin['type']) ?? 'analyzer',
          verified: ext.verified ?? false,
        }));
      setMarketplace([...mkt, ...extraPlugins]);
    }
    load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load plugins'))
      .finally(() => setLoading(false));
  }, []);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds(prev => { const next = new Set(prev); busy ? next.add(id) : next.delete(id); return next; });

  const handleToggle = async (id: string) => {
    markBusy(id, true);
    setError(null);
    const plugin = installed.find(p => p.id === id);
    try {
      const updated = await apiTogglePlugin(id);
      setInstalled(prev =>
        prev.map(p => p.id === id ? { ...p, enabled: updated.enabled } : p),
      );
      toast(`${plugin?.name ?? 'Plugin'} ${updated.enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle plugin');
      toast(`Failed to ${plugin?.enabled ? 'disable' : 'enable'} ${plugin?.name ?? 'plugin'}.`, 'error');
    } finally {
      markBusy(id, false);
    }
  };

  const confirmUninstall = async () => {
    if (!uninstallTarget) return;
    const { id, name } = uninstallTarget;
    setUninstalling(true);
    markBusy(id, true);
    setError(null);
    try {
      await apiUninstallPlugin(id);
      setInstalled(prev => prev.filter(p => p.id !== id));
      toast(`${name} uninstalled.`, 'info');
      setUninstallTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to uninstall plugin');
      toast(`Failed to uninstall ${name}.`, 'error');
    } finally {
      markBusy(id, false);
      setUninstalling(false);
    }
  };

  const handleInstall = async (id: string) => {
    markBusy(id, true);
    setError(null);
    try {
      const plugin = await apiInstallPlugin(id);
      // Add to installed list using the server response directly
      setInstalled(prev => [
        ...prev,
        {
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          author: plugin.author,
          description: plugin.description,
          enabled: plugin.enabled ?? true,
          health: plugin.health ?? 'healthy',
          type: plugin.type,
          installedAt: plugin.installedAt ?? new Date().toISOString(),
        },
      ]);
      // Remove from marketplace list
      setMarketplace(prev => prev.filter(p => p.id !== id));
      toast(`${plugin.name} installed.`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to install plugin');
      toast('Failed to install plugin.', 'error');
    } finally {
      markBusy(id, false);
    }
  };

  const filteredMarketplace = marketplace.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Plugins" subtitle="Manage installed plugins and extensions" />
        <LoadingSkeleton variant="list" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Plugins" subtitle="Manage installed plugins and extensions" />

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="ml-3 hover:opacity-80">✕</button>
        </div>
      )}

      {/* Installed Plugins */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Installed Plugins
        </h2>
        {installed.length === 0 ? (
          <EmptyState
            compact
            icon={Package}
            title="No plugins installed"
            description="Browse the marketplace below to install analyzers, collectors, reporters, and integrations that extend Recurrsive."
          />
        ) : (
        <div className="space-y-3">
          {installed.map(plugin => (
            <div key={plugin.id} className="flex items-center justify-between rounded-xl p-4" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3 flex-1">
                <HealthDot health={plugin.health} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{plugin.name}</span>
                    <span className="text-xs text-text-tertiary">v{plugin.version}</span>
                    <TypeBadge type={plugin.type} />
                    <StatusBadge enabled={plugin.enabled} />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{plugin.description} · by {plugin.author}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(plugin.id)} disabled={busyIds.has(plugin.id)} className="p-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-40" style={{ background: 'var(--color-surface)' }} title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'} aria-label={`${plugin.enabled ? 'Disable' : 'Enable'} ${plugin.name}`}>
                  <Power className={`w-4 h-4 ${plugin.enabled ? 'text-green-400' : 'text-gray-500'}`} aria-hidden="true" />
                </button>
                <button onClick={() => setUninstallTarget(plugin)} disabled={busyIds.has(plugin.id)} className="p-2 rounded-lg transition-all hover:opacity-80 text-red-400 disabled:opacity-40" style={{ background: 'var(--color-surface)' }} title="Uninstall plugin" aria-label={`Uninstall ${plugin.name}`}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Marketplace */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Marketplace
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              placeholder="Search plugins..."
              aria-label="Search plugins"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            aria-label="Filter by plugin type"
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
          >
            <option value="all">All Types</option>
            <option value="analyzer">Analyzers</option>
            <option value="collector">Collectors</option>
            <option value="reporter">Reporters</option>
            <option value="integration">Integrations</option>
          </select>
        </div>
        <div className="space-y-3">
          {filteredMarketplace.map(plugin => (
            <div key={plugin.id} className="flex items-center justify-between rounded-xl p-4" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{plugin.name}</span>
                  <TypeBadge type={plugin.type} />
                  {plugin.verified && <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">✓ Verified</span>}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{plugin.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {plugin.rating > 0 ? plugin.rating.toFixed(1) : 'Not rated'}</span>
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {plugin.downloads.toLocaleString()}</span>
                  <span>by {plugin.author}</span>
                </div>
              </div>
              <button
                onClick={() => handleInstall(plugin.id)}
                disabled={busyIds.has(plugin.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
                style={{ background: 'var(--color-accent)' }}
              >
                {busyIds.has(plugin.id) ? 'Installing…' : 'Install'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Plugin SDK Info */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-2">Plugin SDK</h2>
        <p className="text-sm text-text-secondary">Build custom plugins with the Recurrsive Plugin SDK. Supports analyzers, collectors, reporters, and integrations.</p>
        <code className="block mt-3 px-4 py-3 rounded-lg text-xs text-green-400 font-mono" style={{ background: 'var(--color-base)' }}>
          npm install @recurrsive/plugin-sdk
        </code>
      </div>

      {/* Uninstall confirmation */}
      <ConfirmDialog
        open={uninstallTarget !== null}
        title="Uninstall plugin"
        destructive
        loading={uninstalling}
        confirmLabel="Uninstall"
        message={
          <>
            Uninstall{' '}
            <span className="font-semibold text-text-primary">{uninstallTarget?.name}</span>? Its analyzers and
            configuration will be removed. You can reinstall it later from the marketplace.
          </>
        }
        onConfirm={confirmUninstall}
        onCancel={() => { if (!uninstalling) setUninstallTarget(null); }}
      />
    </div>
  );
}
