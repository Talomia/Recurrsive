'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Store,
  Boxes,
  Gauge,
  ShieldCheck,
  DollarSign,
  Database,
  FileText,
  FileCode2,
  Package,
  Activity,
  Brain,
  Cpu,
  Eye,
  Users,
  ArrowRight,
  Sparkles,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

// ── Built-in analyzers (ship with the open-source platform) ──────────────────
// These are the 12 analyzers included in @recurrsive/analyzers. They are part of
// the core install — not marketplace downloads — so no ratings or download counts
// are shown.
const BUILT_IN_ANALYZERS = [
  { name: 'Architecture', icon: Boxes, color: 'var(--purple)', description: 'Module coupling, dependency graphs, and structural patterns across the codebase.' },
  { name: 'AI', icon: Brain, color: '#a855f7', description: 'AI/LLM integration patterns, prompt usage, and evaluation coverage.' },
  { name: 'AI Runtime', icon: Cpu, color: '#e879f9', description: 'Model monitoring signals, prompt-injection risks, and LLM cost optimization.' },
  { name: 'API Contract', icon: FileCode2, color: '#ec4899', description: 'OpenAPI validation, breaking-change detection, and contract consistency.' },
  { name: 'Cost', icon: DollarSign, color: 'var(--green)', description: 'Cloud spend signals, over-provisioning, and cost-per-feature modeling.' },
  { name: 'Data', icon: Database, color: 'var(--cyan)', description: 'Data flows, schema evolution, PII exposure, and migration management.' },
  { name: 'Dependency', icon: Package, color: '#14b8a6', description: 'Dependency health, version staleness, and license compliance.' },
  { name: 'Documentation', icon: FileText, color: 'var(--amber)', description: 'Documentation coverage, stale docs, and undocumented public APIs.' },
  { name: 'Performance', icon: Gauge, color: 'var(--blue)', description: 'Bottlenecks, N+1 queries, blocking calls, and missing caching.' },
  { name: 'Product', icon: Sparkles, color: '#f97316', description: 'Endpoint test coverage and product-surface quality signals.' },
  { name: 'Reliability', icon: Activity, color: '#06b6d4', description: 'Resilience patterns — retries, timeouts, circuit breakers, health checks.' },
  { name: 'Security', icon: ShieldCheck, color: 'var(--red)', description: 'OWASP-style checks, secret leaks, and insecure configuration.' },
];

// ── Community extension shape returned by GET /api/v1/marketplace/extensions ──
interface Extension {
  id: string;
  name: string;
  author: string;
  description: string;
  category: string;
  source: string;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  repository?: string;
}

type FetchState = 'loading' | 'empty' | 'error' | 'ready';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

export default function MarketplacePage() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [state, setState] = useState<FetchState>('loading');

  useEffect(() => {
    // Wire to the real server marketplace API. When no backend is configured or
    // it has no published community extensions, we show an honest empty state.
    if (!API_BASE) {
      setState('empty');
      return;
    }

    const controller = new AbortController();

    // The extension list endpoint is public (optionalAuth on the server), so no
    // API key is sent — never expose a NEXT_PUBLIC_* key to visitors.
    fetch(`${API_BASE}/api/v1/marketplace/extensions?source=community`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: { data?: Extension[] }) => {
        const data = body.data ?? [];
        setExtensions(data);
        setState(data.length === 0 ? 'empty' : 'ready');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState('error');
      });

    return () => controller.abort();
  }, []);

  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -200, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Store size={14} /> Marketplace
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            Extend <span className="text-gradient">Recurrsive</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 620,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Recurrsive ships with 12 built-in analyzers and a Plugin SDK for building your own
            collectors, analyzers, policies, and intelligence packs.
          </p>
        </div>
      </section>

      {/* Built-in analyzers */}
      <section className="section-sm">
        <div className="container-wide">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-sm)' }}>
              Built-in <span className="text-gradient">Analyzers</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', fontSize: '0.98rem' }}>
              Included with every install — no download required.
            </p>
          </div>
          <div className="grid-4">
            {BUILT_IN_ANALYZERS.map((a) => (
              <div key={a.name} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      background: `${a.color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${a.color}33`,
                      flexShrink: 0,
                    }}
                  >
                    <a.icon size={22} style={{ color: a.color }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{a.name}</h4>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--text-accent)',
                      }}
                    >
                      Built-in
                    </span>
                  </div>
                </div>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {a.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community extensions (wired to real API, empty by default) */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container-wide">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-sm)' }}>
              Community <span className="text-gradient">Extensions</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', fontSize: '0.98rem' }}>
              Extensions published by the community to a connected Recurrsive server.
            </p>
          </div>

          {state === 'loading' && (
            <div
              className="glass-card"
              style={{ textAlign: 'center', padding: 'var(--space-3xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}
            >
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading extensions…</p>
            </div>
          )}

          {state === 'error' && (
            <div
              className="glass-card"
              style={{ textAlign: 'center', padding: 'var(--space-3xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', border: '1px dashed var(--border-medium)' }}
            >
              <AlertCircle size={40} style={{ color: 'var(--amber)', marginBottom: 'var(--space-sm)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Couldn&apos;t reach the marketplace</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 420, fontSize: '0.9rem' }}>
                The configured Recurrsive server didn&apos;t respond. Community extensions are served
                by a running server — check that it&apos;s reachable and that credentials are set.
              </p>
            </div>
          )}

          {state === 'empty' && (
            <div
              className="glass-card"
              style={{ textAlign: 'center', padding: 'var(--space-3xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', border: '1px dashed var(--border-medium)' }}
            >
              <Store size={44} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No community extensions yet</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto var(--space-md)', fontSize: '0.9rem' }}>
                No one has published a community extension yet. Be the first — build one with the
                Plugin SDK and submit it for review.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link href="/marketplace/submit" className="btn btn-primary btn-sm">
                  Submit an Extension
                </Link>
                <Link href="/docs/plugin-sdk" className="btn btn-secondary btn-sm">
                  Plugin SDK Docs
                </Link>
              </div>
            </div>
          )}

          {state === 'ready' && (
            <div className="grid-4">
              {extensions.map((ext) => (
                <div key={ext.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-md)' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(6, 182, 212, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(6, 182, 212, 0.2)',
                        flexShrink: 0,
                      }}
                    >
                      <Users size={22} style={{ color: 'var(--cyan)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{ext.name}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>by {ext.author}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1, marginBottom: 'var(--space-md)' }}>
                    {ext.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                    <span>{ext.category}</span>
                    <span>v{ext.version}</span>
                  </div>
                  {ext.repository ? (
                    <a
                      href={ext.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} /> View Source
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="divider-gradient" style={{ marginBottom: 'var(--space-3xl)' }} />
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Build Your Own <span className="text-gradient">Extensions</span>
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 500,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.05rem',
            }}
          >
            Use the Plugin SDK to create custom analyzers, collectors, and intelligence packs for your team.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/docs/plugin-sdk" className="btn btn-primary btn-lg">
              <Sparkles size={18} /> Plugin SDK Docs
            </Link>
            <Link href="/marketplace/submit" className="btn btn-secondary btn-lg">
              Submit an Extension <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
