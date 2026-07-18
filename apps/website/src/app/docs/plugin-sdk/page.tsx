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
  Users,
  ArrowDown,
  Database,
  Network,
  Info,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Plugin SDK — Recurrsive Docs',
  description:
    'Extend Recurrsive with custom collectors, analyzers, and reasoning specialists built against the real extension interfaces.',
};

const COLLECTOR_LIFECYCLE = [
  { step: 'initialize', desc: 'Receive the CollectorConfig, set up connections, validate credentials', color: 'var(--purple)' },
  { step: 'validate', desc: 'Return { valid, errors } after checking the target is reachable', color: 'var(--blue)' },
  { step: 'collect', desc: 'Gather data and return a CollectorResult of entities, relationships, and metadata', color: 'var(--cyan)' },
  { step: 'dispose', desc: 'Clean up connections, flush buffers, release resources', color: 'var(--green)' },
];

const ANALYZER_LIFECYCLE = [
  { step: 'initialize', desc: 'One-time setup: load configuration, warm caches, prepare state', color: 'var(--purple)' },
  { step: 'analyze', desc: 'Read the knowledge graph via ctx.graph and return Finding[]', color: 'var(--blue)' },
  { step: 'finalize', desc: 'Emit any summary-level findings after the main pass', color: 'var(--green)' },
];

const ENTITY_TYPES = ['file', 'function', 'class', 'module', 'endpoint', 'dependency', 'table', 'query', 'deployment', 'pipeline', 'config', 'agent', 'tool'];
const RELATION_TYPES = ['imports', 'calls', 'extends', 'implements', 'depends_on', 'references', 'owns', 'deploys_to', 'tests', 'routes_to', 'queries_table', 'migrates'];

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
            <Puzzle size={14} /> Extension Points
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
            Extend Recurrsive with custom collectors, analyzers, and reasoning specialists. Implement
            the platform&apos;s TypeScript interfaces and register them with the built-in registries.
          </p>
        </div>
      </section>

      {/* SDK status note */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div className="glass-card" style={{ padding: 'var(--space-md) var(--space-lg)', borderLeft: '3px solid var(--amber)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Info size={20} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>There is no separately published <code style={{ fontFamily: 'var(--font-mono)' }}>@recurrsive/sdk</code> package yet.</strong>{' '}
              The extension points are the interfaces exported by the workspace packages —{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>@recurrsive/core</span> (types),{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>@recurrsive/collectors</span>,{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>@recurrsive/analyzers</span>, and{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>@recurrsive/reasoning</span>. Build against
              those directly, as the built-in collectors and analyzers do.
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ marginBottom: 'var(--space-xl)' }}>
            Extension <span className="text-gradient">Architecture</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            Recurrsive exposes three extension points. <strong style={{ color: 'var(--text-primary)' }}>Collectors</strong> bring
            data into the knowledge graph, <strong style={{ color: 'var(--text-primary)' }}>Analyzers</strong> extract findings from it,
            and <strong style={{ color: 'var(--text-primary)' }}>Specialists</strong> add domain perspectives to the multi-agent reasoning engine.
          </p>
          <div className="grid-3">
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <Boxes size={32} style={{ color: 'var(--blue)', marginBottom: 'var(--space-md)' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>Collectors</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Implement the <code style={{ fontFamily: 'var(--font-mono)' }}>Collector</code> interface to ingest data
                from external sources and return typed entities and relationships.
              </p>
            </div>
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <Eye size={32} style={{ color: 'var(--purple)', marginBottom: 'var(--space-md)' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>Analyzers</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Implement the <code style={{ fontFamily: 'var(--font-mono)' }}>Analyzer</code> interface to read the graph
                and produce findings with severity, evidence, and confidence.
              </p>
            </div>
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <Users size={32} style={{ color: 'var(--cyan)', marginBottom: 'var(--space-md)' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>Specialists</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Use <code style={{ fontFamily: 'var(--font-mono)' }}>createCustomSpecialist</code> to add a domain expert
                to the debate that runs alongside the built-in specialists.
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
            The knowledge graph uses a typed schema of 43 entity types (<span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>EntityType</span>)
            and 43 relationship types (<span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>RelationType</span>), both
            exported from <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>@recurrsive/core</span>. All type
            literals are lowercase <code style={{ fontFamily: 'var(--font-mono)' }}>snake_case</code>.
          </p>
          <div className="grid-2">
            <div className="glass-card">
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={18} style={{ color: 'var(--blue)' }} />
                Entity Types
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan)' }}>43</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ENTITY_TYPES.map((t) => (
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
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--purple)' }} />
                Relationship Types
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan)' }}>43</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {RELATION_TYPES.map((t) => (
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
            <div><span className="keyword">import type</span> {'{'} <span className="function">Collector</span>, <span className="function">CollectorConfig</span>, <span className="function">CollectorResult</span>, <span className="function">CollectorType</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/core&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">nowISO</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/core&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="keyword">export class</span> <span className="function">SentryCollector</span> <span className="keyword">implements</span> <span className="function">Collector</span> {'{'}</div>
            <div>{'  '}<span className="keyword">readonly</span> id = <span className="string">&apos;error-tracking.sentry&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> name = <span className="string">&apos;Sentry Collector&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> description = <span className="string">&apos;Ingests Sentry issues as incident entities.&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> type: <span className="function">CollectorType</span> = <span className="string">&apos;observability&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> version = <span className="string">&apos;0.1.0&apos;</span>;</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">initialize</span>(config: <span className="function">CollectorConfig</span>): <span className="function">Promise</span>&lt;<span className="keyword">void</span>&gt; {'{'}</div>
            <div>{'    '}<span className="keyword">this</span>.client = <span className="keyword">new</span> <span className="function">SentryClient</span>(config.credentials?.values.dsn);</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">validate</span>() {'{'}</div>
            <div>{'    '}<span className="keyword">const</span> ok = <span className="keyword">await this</span>.client.<span className="function">healthCheck</span>();</div>
            <div>{'    '}<span className="keyword">return</span> {'{'} valid: ok, errors: ok ? [] : [<span className="string">&apos;Sentry unreachable&apos;</span>] {'}'};</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">collect</span>(): <span className="function">Promise</span>&lt;<span className="function">CollectorResult</span>&gt; {'{'}</div>
            <div>{'    '}<span className="keyword">const</span> start = Date.<span className="function">now</span>();</div>
            <div>{'    '}<span className="keyword">const</span> entities = (<span className="keyword">await this</span>.client.<span className="function">listIssues</span>()).<span className="function">map</span>(toEntity);</div>
            <div style={{ marginTop: 4 }}>{'    '}<span className="keyword">return</span> {'{'}</div>
            <div>{'      '}entities,</div>
            <div>{'      '}relationships: [],</div>
            <div>{'      '}metadata: {'{'}</div>
            <div>{'        '}collector_id: <span className="keyword">this</span>.id,</div>
            <div>{'        '}collected_at: <span className="function">nowISO</span>(),</div>
            <div>{'        '}duration_ms: Date.<span className="function">now</span>() - start,</div>
            <div>{'        '}items_processed: entities.length,</div>
            <div>{'        '}errors: [],</div>
            <div>{'      }'},</div>
            <div>{'    }'};</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">dispose</span>() {'{'} <span className="keyword">await this</span>.client.<span className="function">close</span>(); {'}'}</div>
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
            <div><span className="keyword">import type</span> {'{'} <span className="function">Analyzer</span>, <span className="function">AnalysisContext</span>, <span className="function">Finding</span>, <span className="function">OpportunityCategory</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/core&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">createFinding</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/analyzers&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="keyword">export class</span> <span className="function">CouplingAnalyzer</span> <span className="keyword">implements</span> <span className="function">Analyzer</span> {'{'}</div>
            <div>{'  '}<span className="keyword">readonly</span> id = <span className="string">&apos;architecture.coupling&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> name = <span className="string">&apos;Coupling Analyzer&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> description = <span className="string">&apos;Flags modules with excessive outgoing dependencies.&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> version = <span className="string">&apos;0.1.0&apos;</span>;</div>
            <div>{'  '}<span className="keyword">readonly</span> categories: <span className="function">OpportunityCategory</span>[] = [<span className="string">&apos;architecture&apos;</span>];</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">initialize</span>() {'{'}{'}'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">analyze</span>(ctx: <span className="function">AnalysisContext</span>): <span className="function">Promise</span>&lt;<span className="function">Finding</span>[]&gt; {'{'}</div>
            <div>{'    '}<span className="keyword">const</span> findings: <span className="function">Finding</span>[] = [];</div>
            <div>{'    '}<span className="keyword">const</span> modules = <span className="keyword">await</span> ctx.graph.<span className="function">getEntities</span>(<span className="string">&apos;module&apos;</span>);</div>
            <div style={{ marginTop: 4 }}>{'    '}<span className="keyword">for</span> (<span className="keyword">const</span> mod <span className="keyword">of</span> modules) {'{'}</div>
            <div>{'      '}<span className="keyword">const</span> edges = <span className="keyword">await</span> ctx.graph.<span className="function">getRelationships</span>(mod.id, <span className="string">&apos;out&apos;</span>);</div>
            <div>{'      '}<span className="keyword">const</span> deps = edges.<span className="function">filter</span>((r) ={'>'} r.type === <span className="string">&apos;depends_on&apos;</span>);</div>
            <div>{'      '}<span className="keyword">if</span> (deps.length {'>'} <span className="number">15</span>) {'{'}</div>
            <div>{'        '}findings.<span className="function">push</span>(<span className="function">createFinding</span>({'{'}</div>
            <div>{'          '}analyzer_id: <span className="keyword">this</span>.id,</div>
            <div>{'          '}title: <span className="string">`High coupling in ${'{'}</span>mod.name<span className="string">{'}'}`</span>,</div>
            <div>{'          '}description: <span className="string">`Depends on ${'{'}</span>deps.length<span className="string">{'}'} modules.`</span>,</div>
            <div>{'          '}severity: <span className="string">&apos;high&apos;</span>,</div>
            <div>{'          '}category: <span className="string">&apos;architecture&apos;</span>,</div>
            <div>{'          '}evidence: [], locations: [], tags: [<span className="string">&apos;coupling&apos;</span>],</div>
            <div>{'          '}confidence: <span className="number">0.9</span>,</div>
            <div>{'        }'}));</div>
            <div>{'      }'}</div>
            <div>{'    }'}</div>
            <div>{'    '}<span className="keyword">return</span> findings;</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">async</span> <span className="function">finalize</span>() {'{'} <span className="keyword">return</span> []; {'}'}</div>
            <div>{'}'}</div>
          </div>
        </div>
      </section>

      {/* Custom Specialist Example */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>
            Example: Custom <span className="text-gradient">Specialist</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Custom specialists join the multi-agent debate alongside the 19 built-in specialists. Roles
            must map to an existing <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>SpecialistRole</span>.
          </p>
          <div className="code-block">
            <div><span className="keyword">import</span> {'{'} <span className="function">createCustomSpecialist</span>, <span className="function">SpecialistRegistry</span>, <span className="function">SpecialistTemplate</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/reasoning&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="keyword">const</span> dataEngineer = <span className="function">createCustomSpecialist</span>({'{'}</div>
            <div>{'  '}name: <span className="string">&apos;Data Pipeline Engineer&apos;</span>,</div>
            <div>{'  '}description: <span className="string">&apos;Evaluates data pipeline reliability.&apos;</span>,</div>
            <div>{'  '}domain: <span className="string">&apos;data-engineering&apos;</span>,</div>
            <div>{'  '}role: <span className="string">&apos;backend_engineer&apos;</span>,</div>
            <div>{'  '}expertiseAreas: [<span className="string">&apos;ETL&apos;</span>, <span className="string">&apos;streaming&apos;</span>, <span className="string">&apos;schema evolution&apos;</span>],</div>
            <div>{'  '}cognitiveFramework: <span className="string">&apos;Evaluate pipeline reliability and schema drift...&apos;</span>,</div>
            <div>{'}'});</div>
            <div style={{ marginTop: 8 }}><span className="keyword">const</span> registry = <span className="keyword">new</span> <span className="function">SpecialistRegistry</span>();</div>
            <div>registry.<span className="function">register</span>(dataEngineer);</div>
            <div>registry.<span className="function">register</span>(<span className="function">SpecialistTemplate</span>.<span className="function">createSecurityAuditor</span>());</div>
          </div>
        </div>
      </section>

      {/* Registration */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Settings size={28} style={{ color: 'var(--text-accent)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Registration</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Register collectors and analyzers with their respective registries before running the
            pipeline. The registries drive collection and analysis.
          </p>
          <div className="code-block">
            <div><span className="keyword">import</span> {'{'} <span className="function">CollectorRegistry</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/collectors&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">AnalyzerRegistry</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/analyzers&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">SentryCollector</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;./plugins/sentry-collector&apos;</span>;</div>
            <div><span className="keyword">import</span> {'{'} <span className="function">CouplingAnalyzer</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;./plugins/coupling-analyzer&apos;</span>;</div>
            <div style={{ marginTop: 8 }}><span className="keyword">const</span> collectors = <span className="keyword">new</span> <span className="function">CollectorRegistry</span>();</div>
            <div>collectors.<span className="function">register</span>(<span className="keyword">new</span> <span className="function">SentryCollector</span>());</div>
            <div style={{ marginTop: 8 }}><span className="keyword">const</span> analyzers = <span className="keyword">new</span> <span className="function">AnalyzerRegistry</span>();</div>
            <div>analyzers.<span className="function">register</span>(<span className="keyword">new</span> <span className="function">CouplingAnalyzer</span>());</div>
          </div>
        </div>
      </section>

      {/* Testing */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--green)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Testing Plugins</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            There is no dedicated testing-utilities package. Test collectors and analyzers with your own
            framework (the workspace uses Vitest) by constructing the inputs the interfaces expect — a{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>CollectorConfig</span> for collectors, or an{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>AnalysisContext</span> (with a stub{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>GraphClient</span>) for analyzers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {[
              'The built-in collectors and analyzers ship __tests__ directories you can copy as templates',
              'GraphClient is a small interface (getEntity, getEntities, getRelationships, query, getNeighbors) — easy to stub',
              'createFinding from @recurrsive/analyzers builds well-formed findings for assertions',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item}</span>
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
            Study the built-in collectors and analyzers in the repository, then implement your own against
            the same interfaces.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="https://github.com/Talomia/Recurrsive/blob/main/docs/PLUGIN_SDK.md" className="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">
              Plugin SDK Docs <ArrowRight size={18} />
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
