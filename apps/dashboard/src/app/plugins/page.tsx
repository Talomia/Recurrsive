'use client';

/**
 * Plugin Marketplace page.
 *
 * Lists installed plugins, marketplace plugins, health indicators, and SDK info.
 */

import { useState, useEffect } from 'react';
import { Package, Download, Power, Shield, Star, Search } from 'lucide-react';

interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'error';
  type: 'analyzer' | 'collector' | 'reporter' | 'integration';
  installedAt: string;
}

interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  stars: number;
  downloads: number;
  type: 'analyzer' | 'collector' | 'reporter' | 'integration';
  verified: boolean;
}

const demoInstalled: InstalledPlugin[] = [
  { id: 'p1', name: 'ESLint Analyzer', version: '3.2.1', author: 'Recurrsive', description: 'Static analysis via ESLint rules', enabled: true, health: 'healthy', type: 'analyzer', installedAt: '2026-05-10' },
  { id: 'p2', name: 'Sonar Collector', version: '1.8.0', author: 'Community', description: 'Import findings from SonarQube', enabled: true, health: 'degraded', type: 'collector', installedAt: '2026-04-22' },
  { id: 'p3', name: 'Slack Notifier', version: '2.0.4', author: 'Recurrsive', description: 'Push notifications to Slack channels', enabled: false, health: 'healthy', type: 'integration', installedAt: '2026-06-01' },
  { id: 'p4', name: 'PDF Reporter', version: '1.3.0', author: 'Community', description: 'Generate PDF executive reports', enabled: true, health: 'error', type: 'reporter', installedAt: '2026-03-15' },
];

const demoMarketplace: MarketplacePlugin[] = [
  { id: 'm1', name: 'Semgrep Analyzer', version: '2.1.0', author: 'r2c', description: 'Lightweight static analysis with custom rules', stars: 482, downloads: 12400, type: 'analyzer', verified: true },
  { id: 'm2', name: 'GitHub Collector', version: '1.5.2', author: 'Recurrsive', description: 'Sync issues and PRs from GitHub repos', stars: 314, downloads: 8900, type: 'collector', verified: true },
  { id: 'm3', name: 'Jira Integration', version: '3.0.1', author: 'Atlassian', description: 'Two-way sync with Jira tickets', stars: 256, downloads: 7200, type: 'integration', verified: true },
  { id: 'm4', name: 'HTML Reporter', version: '1.0.3', author: 'Community', description: 'Interactive HTML dashboards for reports', stars: 89, downloads: 2100, type: 'reporter', verified: false },
  { id: 'm5', name: 'Terraform Scanner', version: '0.9.0', author: 'Community', description: 'IaC security scanning for Terraform files', stars: 134, downloads: 3400, type: 'analyzer', verified: false },
];

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
    // Synthetic data — no real fetch
    setTimeout(() => {
      setInstalled(demoInstalled);
      setMarketplace(demoMarketplace);
      setLoading(false);
    }, 300);
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
