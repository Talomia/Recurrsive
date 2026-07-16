import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Map,
  ArrowRight,
  Boxes,
  Layers,
  Brain,
  Sparkles,
  Eye,
  Database,
  Network,
  Package,
  Puzzle,
  Monitor,
  Terminal,
  Globe,
  Server,
  ArrowDown,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Architecture — Recurrsive Docs',
  description:
    'Deep-dive into Recurrsive internals: analysis pipeline, knowledge graph, multi-agent reasoning, and extension model.',
};

const PIPELINE = [
  {
    icon: Boxes,
    title: 'Collect',
    desc: '14 collectors ingest evidence from Git, GitHub, GitLab, OpenTelemetry, cloud cost APIs, APM, AI platforms, databases, CI/CD, and documentation.',
    color: '#7c3aed',
  },
  {
    icon: Layers,
    title: 'Parse',
    desc: 'Tree-sitter parsers extract structural information from TypeScript, Python, and Go source files. Produces AST-level entities and relationships.',
    color: '#3b82f6',
  },
  {
    icon: Eye,
    title: 'Analyze',
    desc: '12 analyzers with 80+ rules evaluate architecture, performance, security, cost, data quality, documentation, DevOps, API contracts, and more.',
    color: '#06b6d4',
  },
  {
    icon: Brain,
    title: 'Reason',
    desc: '19 specialist AI agents debate recommendations using a structured protocol. Evidence is fused, conflicts resolved, and confidence calibrated.',
    color: '#f59e0b',
  },
  {
    icon: Sparkles,
    title: 'Present',
    desc: 'Ranked, evidence-backed opportunities with expected business impact, validation plans, and rollback strategies delivered via dashboard, API, or CLI.',
    color: '#22c55e',
  },
];

const CORE_PACKAGES = [
  { name: '@recurrsive/core', desc: 'Analysis pipeline orchestration and lifecycle management' },
  { name: '@recurrsive/graph', desc: 'Knowledge graph abstraction (AGE + SQLite backends)' },
  { name: '@recurrsive/collectors', desc: '14 built-in data collectors (Git, GitHub, OTEL, etc.)' },
  { name: '@recurrsive/analyzers', desc: '12 domain analyzers with 80+ analysis rules' },
  { name: '@recurrsive/reasoning', desc: 'Multi-agent debate engine and specialist framework' },
  { name: '@recurrsive/types', desc: '43 entity types + 43 relationship types (shared schema)' },
  { name: '@recurrsive/sdk', desc: 'Plugin SDK for custom collectors and analyzers' },
  { name: '@recurrsive/cli', desc: 'Command-line interface (28 commands)' },
  { name: '@recurrsive/mcp', desc: 'Model Context Protocol server (42 tools, 21 prompts)' },
];

const APPS = [
  { name: 'api', desc: 'REST API server (160+ endpoints, WebSocket)', icon: Globe },
  { name: 'dashboard', desc: 'Interactive web dashboard and graph explorer', icon: Monitor },
  { name: 'website', desc: 'Marketing and documentation website', icon: Server },
  { name: 'cli', desc: 'Standalone CLI binary distribution', icon: Terminal },
  { name: 'worker', desc: 'Background job processor for async analysis', icon: Boxes },
];

const SPECIALISTS = [
  'Architecture', 'Performance', 'Security', 'Cost', 'Data',
  'Documentation', 'DevOps', 'API Contract', 'Dependency', 'Code Quality',
  'Reliability', 'AI Runtime', 'AI Patterns', 'Testing', 'Accessibility',
  'Scalability', 'Observability', 'Compliance', 'Developer Experience',
];

export default function ArchitecturePage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div className="glow-orb glow-purple" style={{ width: 500, height: 500, top: -200, left: '20%' }} />
        <div className="glow-orb glow-blue" style={{ width: 400, height: 400, top: -100, right: '10%' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Map size={14} /> Architecture
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">Architecture</span>
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
            How Recurrsive works under the hood — from data collection to AI-powered recommendations.
          </p>
        </div>
      </section>

      {/* System Diagram */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            System <span className="text-gradient">Overview</span>
          </h2>
          <div
            className="glass-card"
            style={{
              padding: 'var(--space-2xl)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              lineHeight: 2,
              textAlign: 'center',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'inline-block', textAlign: 'left' }}>
              <div style={{ color: 'var(--text-tertiary)' }}>{'┌──────────────── Data Sources ────────────────┐'}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{'│  Git  GitHub  GitLab  OTEL  Cloud  APM  AI  │'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'└─────────────────────┬────────────────────────┘'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      │'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      ▼'}</div>
              <div style={{ color: '#7c3aed' }}>{'              ┌─── Collect ───┐'}</div>
              <div style={{ color: '#7c3aed' }}>{'              │ 14 Collectors  │'}</div>
              <div style={{ color: '#7c3aed' }}>{'              └───────┬───────┘'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      │'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      ▼'}</div>
              <div style={{ color: '#3b82f6' }}>{'               ┌─── Parse ───┐'}</div>
              <div style={{ color: '#3b82f6' }}>{'               │ Tree-sitter  │'}</div>
              <div style={{ color: '#3b82f6' }}>{'               └──────┬──────┘'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      │'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      ▼'}</div>
              <div style={{ color: '#06b6d4' }}>{'       ┌────── Knowledge Graph ──────┐'}</div>
              <div style={{ color: '#06b6d4' }}>{'       │  PostgreSQL AGE / SQLite    │'}</div>
              <div style={{ color: '#06b6d4' }}>{'       │  43 types · 43 relations    │'}</div>
              <div style={{ color: '#06b6d4' }}>{'       └─────────────┬──────────────┘'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      │'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'              ┌───────┴───────┐'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'              ▼               ▼'}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <span style={{ color: '#f59e0b' }}>{'┌── Analyze ──┐'}</span>
                <span style={{ color: '#f59e0b' }}>{'┌── Reason ───┐'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <span style={{ color: '#f59e0b' }}>{'│ 12 Analyzers│'}</span>
                <span style={{ color: '#f59e0b' }}>{'│ 19 Agents   │'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <span style={{ color: '#f59e0b' }}>{'└──────┬──────┘'}</span>
                <span style={{ color: '#f59e0b' }}>{'└──────┬──────┘'}</span>
              </div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'              └───────┬───────┘'}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{'                      ▼'}</div>
              <div style={{ color: '#22c55e' }}>{'      ┌──────── Present ─────────┐'}</div>
              <div style={{ color: '#22c55e' }}>{'      │  API · Dashboard · CLI    │'}</div>
              <div style={{ color: '#22c55e' }}>{'      └────────────────────────── ┘'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            Analysis <span className="text-gradient">Pipeline</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 600, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            Every analysis flows through five sequential stages. Each stage enriches the knowledge
            graph before the next one runs.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {PIPELINE.map((step, i) => (
              <div key={step.title}>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                  <div
                    style={{
                      width: 56, height: 56, borderRadius: 'var(--radius-md)', flexShrink: 0,
                      background: `${step.color}15`,
                      border: `1px solid ${step.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <step.icon size={28} style={{ color: step.color }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-sm)' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800,
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 style={{ fontSize: '1.15rem' }}>{step.title}</h3>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xs) 0' }}>
                    <ArrowDown size={20} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Package Map */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Package <span className="text-gradient">Map</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              9 core packages and 5 applications in a pnpm monorepo.
            </p>
          </div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-lg)' }}>
            <Package size={20} style={{ color: 'var(--text-accent)', marginRight: 8, verticalAlign: 'middle' }} />
            Core Packages
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-3xl)' }}>
            {CORE_PACKAGES.map((pkg) => (
              <div
                key={pkg.name}
                className="glass-card"
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: 'var(--space-md) var(--space-lg)' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--cyan)',
                    minWidth: 240, flexShrink: 0,
                  }}
                >
                  {pkg.name}
                </span>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  {pkg.desc}
                </span>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-lg)' }}>
            <Monitor size={20} style={{ color: 'var(--text-accent)', marginRight: 8, verticalAlign: 'middle' }} />
            Applications
          </h3>
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {APPS.map((app) => (
              <div key={app.name} className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                <app.icon size={24} style={{ color: 'var(--text-accent)', marginBottom: 'var(--space-sm)' }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>
                  {app.name}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  {app.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Knowledge Graph */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3xl)', alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-lg)' }}>
                <Database size={28} style={{ color: 'var(--cyan)' }} />
                <h2 style={{ fontSize: '1.5rem' }}>Knowledge Graph</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
                The knowledge graph is the central data structure. All collectors write to it, all
                analyzers read from it. It stores entities (files, functions, modules, APIs) and
                relationships (imports, calls, deploys).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {[
                  '43 entity types spanning code, infrastructure, and runtime',
                  '43 relationship types with typed properties',
                  'Cypher query language for graph traversal',
                  'ACID transactions via PostgreSQL AGE',
                  'SQLite fallback for local development',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="code-block" style={{ fontSize: '0.82rem' }}>
              <div><span className="comment">{'// Example: Query coupled modules'}</span></div>
              <div style={{ marginTop: 4 }}>
                <span className="keyword">MATCH</span> (m:<span className="function">Module</span>)
              </div>
              <div>
                {'  '}-[r:<span className="function">DEPENDS_ON</span>]-{'>'}(n:<span className="function">Module</span>)
              </div>
              <div>
                <span className="keyword">WITH</span> m, <span className="function">count</span>(r) <span className="keyword">AS</span> deps
              </div>
              <div>
                <span className="keyword">WHERE</span> deps {'>'} <span className="number">10</span>
              </div>
              <div>
                <span className="keyword">RETURN</span> m.name, deps
              </div>
              <div>
                <span className="keyword">ORDER BY</span> deps <span className="keyword">DESC</span>
              </div>
              <div style={{ marginTop: 16 }}><span className="comment">{'// Result:'}</span></div>
              <div><span className="string">{'│ auth-service    │ 23 │'}</span></div>
              <div><span className="string">{'│ api-gateway     │ 18 │'}</span></div>
              <div><span className="string">{'│ payment-module  │ 15 │'}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Agent Reasoning */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <div className="badge badge-accent" style={{ marginBottom: 'var(--space-md)' }}>
              <Brain size={14} /> Multi-Agent AI
            </div>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              <span className="text-gradient">19 Specialists</span> Debate Protocol
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>
              Not a single model guessing — specialized agents bring domain expertise to a
              structured debate, producing high-confidence, evidence-backed recommendations.
            </p>
          </div>

          {/* Debate protocol */}
          <div className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', lineHeight: 2 }}>
              <div style={{ color: 'var(--text-tertiary)' }}>{'// Structured debate protocol'}</div>
              <div><span style={{ color: '#c084fc' }}>Phase 1: Presentation</span> → Each specialist presents evidence from its domain</div>
              <div><span style={{ color: '#60a5fa' }}>Phase 2: Challenge</span> → Cross-domain challenges and counter-evidence</div>
              <div><span style={{ color: '#22d3ee' }}>Phase 3: Synthesis</span> → Evidence fusion and conflict resolution</div>
              <div><span style={{ color: '#86efac' }}>Phase 4: Resolution</span> → Consensus scoring and final ranking</div>
            </div>
          </div>

          {/* Specialists grid */}
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
            Specialist Agents
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SPECIALISTS.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '4px 12px',
                  borderRadius: 'var(--radius-full)', fontWeight: 600,
                  background: 'rgba(124, 58, 237, 0.1)',
                  color: 'var(--text-accent)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Data Flow */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ marginBottom: 'var(--space-xl)' }}>
            Data Flow: Collection to <span className="text-gradient">Recommendations</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {[
              { label: '1. Evidence Collection', desc: 'Collectors ingest raw data from 14 sources and emit typed entities.' },
              { label: '2. Structural Parsing', desc: 'Tree-sitter extracts AST-level structure from source code.' },
              { label: '3. Graph Enrichment', desc: 'Entities and relationships are upserted into the knowledge graph.' },
              { label: '4. Rule Evaluation', desc: '80+ rules from 12 analyzers evaluate the graph and produce findings.' },
              { label: '5. Multi-Agent Debate', desc: '19 specialists reason over findings, fuse evidence, and rank opportunities.' },
              { label: '6. Presentation', desc: 'Prioritized recommendations are delivered via dashboard, API, or CI/CD checks.' },
            ].map((step) => (
              <div key={step.label} className="glass-card" style={{ display: 'flex', gap: '16px', padding: 'var(--space-md) var(--space-lg)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-accent)', minWidth: 180, flexShrink: 0 }}>
                  {step.label}
                </span>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{step.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Extension Model */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Puzzle size={28} style={{ color: 'var(--purple)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Extension Model</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Recurrsive is designed to be extended at every layer. The Plugin SDK provides three
            extension points:
          </p>
          <div className="grid-3">
            {[
              {
                title: 'Custom Collectors',
                desc: 'Bring data from any source into the knowledge graph. Implement the Collector interface with initialize, validate, collect, and dispose hooks.',
                color: 'var(--blue)',
              },
              {
                title: 'Custom Analyzers',
                desc: 'Apply domain-specific rules to the graph. Implement the Analyzer interface with initialize, analyze, and finalize hooks.',
                color: 'var(--purple)',
              },
              {
                title: 'Custom Specialists',
                desc: 'Add new AI reasoning agents to the debate protocol. Implement the Specialist interface with present, challenge, and synthesize hooks.',
                color: 'var(--cyan)',
              },
            ].map((ext) => (
              <div key={ext.title} className="glass-card">
                <div
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: ext.color, marginBottom: 'var(--space-md)',
                  }}
                />
                <h4 style={{ fontSize: '0.95rem', marginBottom: 'var(--space-sm)' }}>{ext.title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {ext.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-purple" style={{ width: 400, height: 400, bottom: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Dive <span className="text-gradient">Deeper</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            Now that you understand the architecture, build a plugin or deploy your own instance.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="/docs/plugin-sdk" className="btn btn-primary btn-lg">
              Plugin SDK <ArrowRight size={18} />
            </Link>
            <Link href="/docs/deployment" className="btn btn-secondary btn-lg">
              Deployment Guide
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
