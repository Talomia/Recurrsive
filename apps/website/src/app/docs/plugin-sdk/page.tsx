import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Puzzle,
  ArrowRight,
  Boxes,
  Eye,
  Layers,
  Settings,
  CheckCircle2,
  TestTube,
  Zap,
  Code2,
  ArrowDown,
  Database,
  Network,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Plugin SDK — Recurrsive Docs',
  description:
    'Build custom analyzers and collectors with the Recurrsive Plugin SDK. Full TypeScript API with lifecycle hooks and type safety.',
};

const COLLECTOR_LIFECYCLE = [
  { step: 'initialize', desc: 'Set up connections, validate credentials, prepare resources', color: 'var(--purple)' },
  { step: 'validate', desc: 'Check that the target is accessible and data format is supported', color: 'var(--blue)' },
  { step: 'collect', desc: 'Gather data from the source and emit entities and relationships', color: 'var(--cyan)' },
  { step: 'dispose', desc: 'Clean up connections, flush buffers, release resources', color: 'var(--green)' },
];

const ANALYZER_LIFECYCLE = [
  { step: 'initialize', desc: 'Load configuration, register rules, set up analysis context', color: 'var(--purple)' },
  { step: 'analyze', desc: 'Traverse the knowledge graph, apply rules, produce findings', color: 'var(--blue)' },
  { step: 'finalize', desc: 'Aggregate results, compute scores, emit summary metrics', color: 'var(--green)' },
];

export default function PluginSdkPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div className="glow-orb glow-purple" style={{ width: 500, height: 500, top: -200, right: '15%' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Puzzle size={14} /> Plugin SDK
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">Plugin SDK</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 640,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Extend Recurrsive with custom analyzers and collectors. Full TypeScript SDK with lifecycle
            hooks, type safety, and built-in testing utilities.
          </p>
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ marginBottom: 'var(--space-xl)' }}>
            Extension <span className="text-gradient">Architecture</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            Recurrsive is built around two primary extension points. <strong style={{ color: 'var(--text-primary)' }}>Collectors</strong> bring
            data into the knowledge graph, and <strong style={{ color: 'var(--text-primary)' }}>Analyzers</strong> extract insights from it.
          </p>
          <div className="grid-2">
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <Boxes size={32} style={{ color: 'var(--blue)', marginBottom: 'var(--space-md)' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>Collectors</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Ingest data from external sources — Git, APIs, databases, cloud providers — and emit
                typed entities and relationships into the knowledge graph.
              </p>
            </div>
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <Eye size={32} style={{ color: 'var(--purple)', marginBottom: 'var(--space-md)' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>Analyzers</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Traverse the knowledge graph, apply domain-specific rules, and produce findings with
                severity, evidence, and recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Collector Lifecycle */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Boxes size={28} style={{ color: 'var(--blue)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Collector Lifecycle</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {COLLECTOR_LIFECYCLE.map((phase, i) => (
              <div key={phase.step}>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: `color-mix(in srgb, ${phase.color} 20%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${phase.color} 35%, transparent)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700,
                      color: phase.color,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 600, color: phase.color, marginBottom: 4 }}>
                      {phase.step}()
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {phase.desc}
                    </p>
                  </div>
                </div>
                {i < COLLECTOR_LIFECYCLE.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xs) 0' }}>
                    <ArrowDown size={18} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Analyzer Lifecycle */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Eye size={28} style={{ color: 'var(--purple)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Analyzer Lifecycle</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {ANALYZER_LIFECYCLE.map((phase, i) => (
              <div key={phase.step}>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: `color-mix(in srgb, ${phase.color} 20%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${phase.color} 35%, transparent)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700,
                      color: phase.color,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 600, color: phase.color, marginBottom: 4 }}>
                      {phase.step}()
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {phase.desc}
                    </p>
                  </div>
                </div>
                {i < ANALYZER_LIFECYCLE.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xs) 0' }}>
                    <ArrowDown size={18} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Type System */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Database size={28} style={{ color: 'var(--cyan)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Type System</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            The knowledge graph uses a rich type system with 43 entity types and 43 relationship
            types. All types are fully exported from{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>@recurrsive/types</span>.
          </p>
          <div className="grid-2">
            <div className="glass-card">
              <h4 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={18} style={{ color: 'var(--blue)' }} />
                Entity Types
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan)' }}>43</span>
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['File', 'Function', 'Class', 'Module', 'Package', 'API', 'Route', 'Query', 'Migration', 'Deployment', 'Pipeline', 'Test', 'Config'].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '3px 10px',
                      borderRadius: 'var(--radius-full)', background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--blue)', border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    {t}
                  </span>
                ))}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '3px 10px' }}>+30 more</span>
              </div>
            </div>
            <div className="glass-card">
              <h4 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--purple)' }} />
                Relationship Types
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan)' }}>43</span>
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['IMPORTS', 'CALLS', 'EXTENDS', 'IMPLEMENTS', 'DEPENDS_ON', 'OWNS', 'DEPLOYS', 'TESTS', 'ROUTES_TO', 'QUERIES', 'MIGRATES', 'CONFIGURES'].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '3px 10px',
                      borderRadius: 'var(--radius-full)', background: 'rgba(124, 58, 237, 0.1)',
                      color: 'var(--purple)', border: '1px solid rgba(124, 58, 237, 0.2)',
                    }}
                  >
                    {t}
                  </span>
                ))}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '3px 10px' }}>+31 more</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Collector Example */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>
            Example: Custom <span className="text-gradient">Collector</span>
          </h2>
          <div className="code-block">
            <div><span className="keyword">import</span> {'{'} <span className="function">Collector</span>, <span className="function">CollectorContext</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/sdk&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="keyword">export class</span> <span className="function">SentryCollector</span> <span className="keyword">extends</span> <span className="function">Collector</span> {'{'}</div>
            <div>{'  '}<span className="keyword">readonly</span> name = <span className="string">&apos;sentry&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> version = <span className="string">&apos;1.0.0&apos;</span>;</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">initialize</span>(ctx: <span className="function">CollectorContext</span>) {'{'}</div>
            <div>{'    '}<span className="keyword">this</span>.client = <span className="keyword">new</span> <span className="function">SentryClient</span>(ctx.config.dsn);</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">validate</span>() {'{'}</div>
            <div>{'    '}<span className="keyword">return this</span>.client.<span className="function">healthCheck</span>();</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">collect</span>(ctx: <span className="function">CollectorContext</span>) {'{'}</div>
            <div>{'    '}<span className="keyword">const</span> issues = <span className="keyword">await this</span>.client.<span className="function">listIssues</span>();</div>
            <div>{'    '}<span className="keyword">for</span> (<span className="keyword">const</span> issue <span className="keyword">of</span> issues) {'{'}</div>
            <div>{'      '}ctx.<span className="function">emitEntity</span>({'{'}</div>
            <div>{'        '}type: <span className="string">&apos;ErrorEvent&apos;</span>,</div>
            <div>{'        '}id: issue.id,</div>
            <div>{'        '}properties: {'{'} title: issue.title, count: issue.count {'}'},</div>
            <div>{'      }'});</div>
            <div>{'    }'}</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">dispose</span>() {'{'}</div>
            <div>{'    '}<span className="keyword">await this</span>.client.<span className="function">close</span>();</div>
            <div>{'  }'}</div>
            <div>{'}'}</div>
          </div>
        </div>
      </section>

      {/* Custom Analyzer Example */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>
            Example: Custom <span className="text-gradient">Analyzer</span>
          </h2>
          <div className="code-block">
            <div><span className="keyword">import</span> {'{'} <span className="function">Analyzer</span>, <span className="function">AnalyzerContext</span>, <span className="function">Severity</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/sdk&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="keyword">export class</span> <span className="function">CouplingAnalyzer</span> <span className="keyword">extends</span> <span className="function">Analyzer</span> {'{'}</div>
            <div>{'  '}<span className="keyword">readonly</span> name = <span className="string">&apos;coupling&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> version = <span className="string">&apos;1.0.0&apos;</span>;</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">analyze</span>(ctx: <span className="function">AnalyzerContext</span>) {'{'}</div>
            <div>{'    '}<span className="keyword">const</span> modules = <span className="keyword">await</span> ctx.graph.<span className="function">query</span>(</div>
            <div>{'      '}<span className="string">&apos;MATCH (m:Module)-[r:DEPENDS_ON]-&gt;(n:Module) RETURN m, count(r) AS deps&apos;</span></div>
            <div>{'    '});</div>
            <div style={{ marginTop: 8 }}>{'    '}<span className="keyword">for</span> (<span className="keyword">const</span> mod <span className="keyword">of</span> modules) {'{'}</div>
            <div>{'      '}<span className="keyword">if</span> (mod.deps {'>'} <span className="number">15</span>) {'{'}</div>
            <div>{'        '}ctx.<span className="function">emitFinding</span>({'{'}</div>
            <div>{'          '}rule: <span className="string">&apos;high-coupling&apos;</span>,</div>
            <div>{'          '}severity: Severity.<span className="keyword">Warning</span>,</div>
            <div>{'          '}message: <span className="string">`Module ${'{'}</span>mod.name<span className="string">{'}'} has ${'{'}</span>mod.deps<span className="string">{'}'} dependencies`</span>,</div>
            <div>{'          '}entity: mod.id,</div>
            <div>{'          '}evidence: {'{'} dependencyCount: mod.deps {'}'},</div>
            <div>{'        }'});</div>
            <div>{'      }'}</div>
            <div>{'    }'}</div>
            <div>{'  }'}</div>
            <div>{'}'}</div>
          </div>
        </div>
      </section>

      {/* Registration */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Settings size={28} style={{ color: 'var(--text-accent)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Registration &amp; Configuration</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Register your plugins in <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>recurrsive.config.ts</span>.
            Each plugin can declare its own configuration schema.
          </p>
          <div className="code-block">
            <div><span className="keyword">import</span> {'{'} <span className="function">defineConfig</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/cli&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">SentryCollector</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;./plugins/sentry-collector&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">CouplingAnalyzer</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;./plugins/coupling-analyzer&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="keyword">export default</span> <span className="function">defineConfig</span>({'{'}</div>
            <div>{'  '}<span className="keyword">plugins</span>: [</div>
            <div>{'    '}<span className="keyword">new</span> <span className="function">SentryCollector</span>({'{'}</div>
            <div>{'      '}dsn: process.env.<span className="keyword">SENTRY_DSN</span>,</div>
            <div>{'      '}project: <span className="string">&apos;my-app&apos;</span>,</div>
            <div>{'    '}{'}'}),</div>
            <div>{'    '}<span className="keyword">new</span> <span className="function">CouplingAnalyzer</span>({'{'}</div>
            <div>{'      '}threshold: <span className="number">15</span>,</div>
            <div>{'    '}{'}'}),</div>
            <div>{'  '}],</div>
            <div>{'}'}{')'};</div>
          </div>
        </div>
      </section>

      {/* Testing */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <TestTube size={28} style={{ color: 'var(--green)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Testing Plugins</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            The SDK ships with testing utilities that let you validate your plugins against a mock
            knowledge graph without running a full analysis.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-xl)' }}>
            <div><span className="keyword">import</span> {'{'} <span className="function">createTestContext</span>, <span className="function">mockGraph</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/sdk/testing&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">CouplingAnalyzer</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;./coupling-analyzer&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="function">describe</span>(<span className="string">&apos;CouplingAnalyzer&apos;</span>, () ={'>'} {'{'}</div>
            <div>{'  '}<span className="function">it</span>(<span className="string">&apos;detects high coupling&apos;</span>, <span className="keyword">async</span> () ={'>'} {'{'}</div>
            <div>{'    '}<span className="keyword">const</span> ctx = <span className="function">createTestContext</span>({'{'}</div>
            <div>{'      '}graph: <span className="function">mockGraph</span>()<br />{'        '}.<span className="function">addModule</span>(<span className="string">&apos;auth&apos;</span>, {'{'} deps: <span className="number">20</span> {'}'})<br />{'        '}.<span className="function">addModule</span>(<span className="string">&apos;utils&apos;</span>, {'{'} deps: <span className="number">3</span> {'}'}),</div>
            <div>{'    }'});</div>
            <div style={{ marginTop: 4 }}>{'    '}<span className="keyword">const</span> analyzer = <span className="keyword">new</span> <span className="function">CouplingAnalyzer</span>();</div>
            <div>{'    '}<span className="keyword">await</span> analyzer.<span className="function">analyze</span>(ctx);</div>
            <div style={{ marginTop: 4 }}>{'    '}<span className="function">expect</span>(ctx.findings).<span className="function">toHaveLength</span>(<span className="number">1</span>);</div>
            <div>{'    '}<span className="function">expect</span>(ctx.findings[<span className="number">0</span>].rule).<span className="function">toBe</span>(<span className="string">&apos;high-coupling&apos;</span>);</div>
            <div>{'  }'});</div>
            <div>{'}'}{')'};</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {[
              'createTestContext — builds an isolated context with mock services',
              'mockGraph — fluent builder for test knowledge graphs',
              'assertFinding — deep equality check for finding properties',
              'snapshotEntities — snapshot testing for emitted entities',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ background: 'var(--bg-secondary)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-purple" style={{ width: 400, height: 400, bottom: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Build Your <span className="text-gradient">First Plugin</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            Start with our template, write your collector or analyzer, and publish to the marketplace.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="/docs/getting-started" className="btn btn-primary btn-lg">
              Getting Started <ArrowRight size={18} />
            </Link>
            <Link href="/docs/architecture" className="btn btn-secondary btn-lg">
              Architecture Guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
