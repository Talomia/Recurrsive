'use client';
/**
 * Plugin Marketplace page.
 *
 * Lists installed plugins, marketplace plugins, health indicators, and SDK info.
 * Fetches data from both legacy plugin endpoints and the new marketplace extensions API.
 */

import { useState, useEffect } from 'react';
import { Package, Download, Power, Shield, Star, Search } from 'lucide-react';
import { getInstalledPlugins, getMarketplacePlugins, getMarketplaceExtensions } from '@/lib/api';
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
          stars: ext.stars ?? 0,
          downloads: ext.downloads ?? 0,
          type: (ext.category as MarketplacePlugin['type']) ?? 'analyzer',
          verified: ext.verified ?? false,
        }));
      setMarketplace([...mkt, ...extraPlugins]);
    }
    load().finally(() => setLoading(false));
  }, []);

  const togglePlugin = (id: string) => {
    setInstalled(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const uninstallPlugin = (id: string) => {
    setInstalled(prev => prev.filter(p => p.id !== id));
  };

  const filteredMarketplace = marketplace.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Package className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            Plugins
          </h1>
          <p className="text-sm text-text-secondary mt-1">{installed.length} installed · {marketplace.length} available in marketplace</p>
        </div>
      </div>

      {/* Installed Plugins */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Installed Plugins
        </h3>
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
                <button onClick={() => togglePlugin(plugin.id)} className="p-2 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-surface)' }}>
                  <Power className={`w-4 h-4 ${plugin.enabled ? 'text-green-400' : 'text-gray-500'}`} />
                </button>
                <button onClick={() => uninstallPlugin(plugin.id)} className="p-2 rounded-lg transition-all hover:opacity-80 text-red-400" style={{ background: 'var(--color-surface)' }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marketplace */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Marketplace
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              placeholder="Search plugins..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
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
                  <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {plugin.stars}</span>
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {plugin.downloads.toLocaleString()}</span>
                  <span>by {plugin.author}</span>
                </div>
              </div>
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
                Install
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Plugin SDK Info */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-2">Plugin SDK</h3>
        <p className="text-sm text-text-secondary">Build custom plugins with the Recurrsive Plugin SDK. Supports analyzers, collectors, reporters, and integrations.</p>
        <code className="block mt-3 px-4 py-3 rounded-lg text-xs text-green-400 font-mono" style={{ background: 'var(--color-base)' }}>
          npm install @recurrsive/plugin-sdk
        </code>
      </div>
    </div>
  );
}
