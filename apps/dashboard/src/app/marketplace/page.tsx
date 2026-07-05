'use client';
/**
 * Marketplace page.
 *
 * Browse extensions, categories, and marketplace stats.
 */

import { useState, useEffect } from 'react';
import { Package, Search, Download, Star, Filter, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

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

export default function MarketplacePage() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const [ext, cat, st] = await Promise.all([
          apiFetch<Extension[]>('/api/v1/marketplace/extensions'),
          apiFetch<Category[]>('/api/v1/marketplace/categories'),
          apiFetch<MarketplaceStats>('/api/v1/marketplace/stats'),
        ]);
        setExtensions(ext ?? []);
        setCategories(cat ?? []);
        setStats(st ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load marketplace data');
      }
    }
    load().finally(() => setLoading(false));
  }, []);

  const filtered = extensions.filter((ext) => {
    const matchesSearch =
      ext.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || ext.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

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
          Marketplace
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Discover and install extensions to enhance your Recurrsive experience.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 hover:opacity-80">✕</button>
        </div>
      )}

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
  );
}
