import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Code2,
  Shield,
  Key,
  Globe,
  ArrowRight,
  Zap,
  Activity,
  BarChart3,
  Network,
  FileText,
  Clock,
  Camera,
  Settings,
  Radio,
  ExternalLink,
  Lock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'API Reference — Recurrsive Docs',
  description:
    'Complete REST API reference for Recurrsive. 138 endpoints covering analysis, graph, policies, and more.',
};

const ENDPOINT_GROUPS = [
  { name: 'Health', count: 3, icon: Activity, color: 'var(--green)', desc: 'Liveness, readiness, and version checks' },
  { name: 'Analysis', count: 4, icon: BarChart3, color: 'var(--blue)', desc: 'Trigger, status, cancel, and list analyses' },
  { name: 'Opportunities', count: 3, icon: Zap, color: 'var(--amber)', desc: 'List, detail, and dismiss improvement opportunities' },
  { name: 'Graph', count: 5, icon: Network, color: 'var(--purple)', desc: 'Query entities, relationships, and subgraphs' },
  { name: 'Findings', count: 3, icon: AlertTriangle, color: 'var(--red)', desc: 'List, detail, and acknowledge findings' },
  { name: 'Reports', count: 1, icon: FileText, color: 'var(--cyan)', desc: 'Generate HTML, PDF, or JSON reports' },
  { name: 'Timeline', count: 3, icon: Clock, color: 'var(--blue)', desc: 'Historical trends, diffs, and snapshots' },
  { name: 'Snapshots', count: 2, icon: Camera, color: 'var(--green)', desc: 'Create and restore analysis snapshots' },
  { name: 'Policies', count: 3, icon: Settings, color: 'var(--purple)', desc: 'CRUD for quality gates and policies' },
];

export default function ApiReferencePage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div className="glow-orb glow-blue" style={{ width: 500, height: 500, top: -200, right: '10%' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Code2 size={14} /> 138 REST endpoints
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">API Reference</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 600,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Full REST API documentation with authentication, rate limiting, WebSocket streaming, and
            OpenAPI specification.
          </p>
        </div>
      </section>

      {/* Authentication */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Shield size={28} style={{ color: 'var(--text-accent)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Authentication</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            Recurrsive supports two authentication methods. Use JWT tokens for user sessions and API
            keys for service-to-service communication.
          </p>
          <div className="grid-2">
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-md)' }}>
                <Lock size={20} style={{ color: 'var(--purple)' }} />
                <h3 style={{ fontSize: '1.05rem' }}>JWT Tokens</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-md)' }}>
                Obtain a token via <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>POST /api/v1/auth/login</span>.
                Tokens expire after 24 hours and support refresh via{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>POST /api/v1/auth/refresh</span>.
              </p>
              <div className="code-block" style={{ padding: 'var(--space-md)' }}>
                <span className="keyword">Authorization</span>: Bearer <span className="string">eyJhbGci...</span>
              </div>
            </div>
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-md)' }}>
                <Key size={20} style={{ color: 'var(--amber)' }} />
                <h3 style={{ fontSize: '1.05rem' }}>API Keys</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-md)' }}>
                Generate long-lived API keys in the dashboard under Settings → API Keys.
                Scope keys to specific permissions using RBAC roles.
              </p>
              <div className="code-block" style={{ padding: 'var(--space-md)' }}>
                <span className="keyword">X-API-Key</span>: <span className="string">rk_live_a1b2c3d4...</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Base URL & Versioning */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Globe size={28} style={{ color: 'var(--cyan)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Base URL &amp; Versioning</h2>
          </div>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 8 }}>
              <span className="comment"># Self-hosted</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="string">https://your-instance.com/api/v1</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span className="comment"># Recurrsive Cloud</span>
            </div>
            <div>
              <span className="string">https://api.recurrsive.dev/v1</span>
            </div>
          </div>
          <div className="glass-card" style={{ padding: 'var(--space-md) var(--space-lg)', borderLeft: '3px solid var(--cyan)' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Versioning:</strong> The API uses URL-based
              versioning. The current version is <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>v1</span>.
              Breaking changes will be introduced in new major versions. Deprecated endpoints return{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>Sunset</span> headers.
            </div>
          </div>
        </div>
      </section>

      {/* Endpoint Groups */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Endpoint <span className="text-gradient">Groups</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              138 endpoints organized into 9 logical groups.
            </p>
          </div>
          <div className="grid-3">
            {ENDPOINT_GROUPS.map((group) => (
              <div key={group.name} className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)', flexShrink: 0,
                    background: `color-mix(in srgb, ${group.color} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${group.color} 25%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <group.icon size={22} style={{ color: group.color }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 4 }}>
                    <h4 style={{ fontSize: '0.95rem' }}>{group.name}</h4>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600,
                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        background: `color-mix(in srgb, ${group.color} 12%, transparent)`,
                        color: group.color,
                      }}
                    >
                      {group.count}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    {group.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Request / Response */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ marginBottom: 'var(--space-xl)' }}>
            Example <span className="text-gradient">Request</span>
          </h2>

          {/* Request */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-sm)' }}>
              <span
                style={{
                  padding: '2px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(34, 197, 94, 0.15)', color: 'var(--green)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700,
                }}
              >
                POST
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                /api/v1/analyses
              </span>
            </div>
          </div>
          <div className="code-block" style={{ marginBottom: 'var(--space-xl)' }}>
            <div><span className="keyword">curl</span> -X POST <span className="string">https://api.recurrsive.dev/v1/analyses</span> \</div>
            <div>{'  '}-H <span className="string">&quot;Authorization: Bearer $TOKEN&quot;</span> \</div>
            <div>{'  '}-H <span className="string">&quot;Content-Type: application/json&quot;</span> \</div>
            <div>{'  '}-d <span className="string">{`'{`}</span></div>
            <div><span className="string">{'    '}&quot;repository&quot;: &quot;https://github.com/acme/app&quot;,</span></div>
            <div><span className="string">{'    '}&quot;branch&quot;: &quot;main&quot;,</span></div>
            <div><span className="string">{'    '}&quot;analyzers&quot;: [&quot;architecture&quot;, &quot;security&quot;, &quot;performance&quot;]</span></div>
            <div><span className="string">{`  }'`}</span></div>
          </div>

          {/* Response */}
          <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-md)' }}>Response</h3>
          <div className="code-block">
            <div>{`{`}</div>
            <div>{'  '}<span className="keyword">&quot;id&quot;</span>: <span className="string">&quot;ana_8f3k2j1m&quot;</span>,</div>
            <div>{'  '}<span className="keyword">&quot;status&quot;</span>: <span className="string">&quot;running&quot;</span>,</div>
            <div>{'  '}<span className="keyword">&quot;repository&quot;</span>: <span className="string">&quot;https://github.com/acme/app&quot;</span>,</div>
            <div>{'  '}<span className="keyword">&quot;branch&quot;</span>: <span className="string">&quot;main&quot;</span>,</div>
            <div>{'  '}<span className="keyword">&quot;analyzers&quot;</span>: [<span className="string">&quot;architecture&quot;</span>, <span className="string">&quot;security&quot;</span>, <span className="string">&quot;performance&quot;</span>],</div>
            <div>{'  '}<span className="keyword">&quot;created_at&quot;</span>: <span className="string">&quot;2026-07-02T10:30:00Z&quot;</span>,</div>
            <div>{'  '}<span className="keyword">&quot;estimated_duration&quot;</span>: <span className="number">45</span></div>
            <div>{`}`}</div>
          </div>
        </div>
      </section>

      {/* Rate Limiting */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Zap size={28} style={{ color: 'var(--amber)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Rate Limiting</h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-xl)',
            }}
          >
            {[
              { tier: 'Free', limit: '60 req/min', burst: '10 req/s' },
              { tier: 'Pro', limit: '600 req/min', burst: '50 req/s' },
              { tier: 'Enterprise', limit: 'Unlimited', burst: 'Custom' },
            ].map((t) => (
              <div key={t.tier} className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 8 }}>{t.tier}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--cyan)', marginBottom: 4 }}>
                  {t.limit}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Burst: {t.burst}</div>
              </div>
            ))}
          </div>
          <div className="code-block" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
            <div><span className="comment"># Rate limit headers in every response</span></div>
            <div><span className="keyword">X-RateLimit-Limit</span>: <span className="number">600</span></div>
            <div><span className="keyword">X-RateLimit-Remaining</span>: <span className="number">594</span></div>
            <div><span className="keyword">X-RateLimit-Reset</span>: <span className="number">1719913860</span></div>
          </div>
        </div>
      </section>

      {/* WebSocket */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Radio size={28} style={{ color: 'var(--green)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>
              WebSocket <span className="text-gradient">Streaming</span>
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Subscribe to real-time analysis updates via WebSocket. Events are emitted as each pipeline
            stage completes.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment">{'// Connect to the WebSocket endpoint'}</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="keyword">const</span> <span className="function">ws</span> = <span className="keyword">new</span> <span className="function">WebSocket</span>(
            </div>
            <div style={{ marginBottom: 12 }}>
              {'  '}<span className="string">&apos;wss://api.recurrsive.dev/v1/ws?token=YOUR_TOKEN&apos;</span>
            </div>
            <div>);</div>
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <span className="comment">{'// Subscribe to analysis events'}</span>
            </div>
            <div>
              <span className="function">ws</span>.<span className="function">send</span>(JSON.<span className="function">stringify</span>({'{'})
            </div>
            <div>{'  '}<span className="keyword">type</span>: <span className="string">&apos;subscribe&apos;</span>,</div>
            <div>{'  '}<span className="keyword">channel</span>: <span className="string">&apos;analysis:ana_8f3k2j1m&apos;</span></div>
            <div>{'}'}));</div>
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <span className="comment">{'// Receive events: collection_complete, parsing_complete,'}</span>
            </div>
            <div>
              <span className="comment">{'// analysis_complete, reasoning_complete, done'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            {['collection_complete', 'parsing_complete', 'analysis_complete', 'reasoning_complete', 'done'].map((evt) => (
              <span
                key={evt}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600,
                  padding: '4px 12px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(34, 197, 94, 0.12)', color: 'var(--green)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}
              >
                {evt}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* OpenAPI CTA */}
      <section className="section" style={{ background: 'var(--bg-secondary)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-purple" style={{ width: 400, height: 400, bottom: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            OpenAPI <span className="text-gradient">Specification</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            Import our OpenAPI 3.1 spec into Postman, Insomnia, or generate client SDKs in any language.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="#" className="btn btn-primary btn-lg">
              <ExternalLink size={18} /> Download OpenAPI Spec
            </Link>
            <Link href="/docs/getting-started" className="btn btn-secondary btn-lg">
              Getting Started <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
