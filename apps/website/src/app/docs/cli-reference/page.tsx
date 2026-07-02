import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Terminal,
  ArrowRight,
  BarChart3,
  FileText,
  Network,
  Brain,
  Shield,
  Wrench,
  Settings,
  Zap,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'CLI Reference — Recurrsive Docs',
  description:
    'Complete command-line interface reference for Recurrsive. 25 commands across 6 groups for analysis, reporting, and automation.',
};

const COMMAND_GROUPS = [
  {
    name: 'Analysis',
    icon: BarChart3,
    color: 'var(--blue)',
    commands: [
      { cmd: 'analyze <path>', desc: 'Run full analysis on a project directory', example: 'recurrsive analyze . --full' },
      { cmd: 'analyze:quick <path>', desc: 'Fast incremental analysis (changed files only)', example: 'recurrsive analyze:quick ./src' },
      { cmd: 'analyze:diff <base> <head>', desc: 'Analyze changes between two commits or branches', example: 'recurrsive analyze:diff main feature/auth' },
      { cmd: 'analyze:watch <path>', desc: 'Watch for file changes and re-analyze automatically', example: 'recurrsive analyze:watch . --debounce 2000' },
    ],
  },
  {
    name: 'Reporting',
    icon: FileText,
    color: 'var(--green)',
    commands: [
      { cmd: 'report', desc: 'Generate analysis report in specified format', example: 'recurrsive report --format html --output ./report' },
      { cmd: 'report:summary', desc: 'Print a compact summary to stdout', example: 'recurrsive report:summary --json' },
      { cmd: 'report:compare <a> <b>', desc: 'Compare two analysis snapshots side-by-side', example: 'recurrsive report:compare snap_a snap_b' },
      { cmd: 'report:export', desc: 'Export findings to CSV, SARIF, or CodeClimate', example: 'recurrsive report:export --format sarif' },
    ],
  },
  {
    name: 'Graph',
    icon: Network,
    color: 'var(--purple)',
    commands: [
      { cmd: 'graph:query <cypher>', desc: 'Run a Cypher query against the knowledge graph', example: 'recurrsive graph:query "MATCH (n:Function) RETURN n LIMIT 10"' },
      { cmd: 'graph:export', desc: 'Export the graph in DOT, GEXF, or JSON format', example: 'recurrsive graph:export --format dot' },
      { cmd: 'graph:visualize', desc: 'Open the interactive graph visualizer in browser', example: 'recurrsive graph:visualize --port 4000' },
      { cmd: 'graph:stats', desc: 'Print entity and relationship counts', example: 'recurrsive graph:stats' },
      { cmd: 'graph:prune', desc: 'Remove stale entities from the graph', example: 'recurrsive graph:prune --older-than 30d' },
    ],
  },
  {
    name: 'Intelligence',
    icon: Brain,
    color: 'var(--cyan)',
    commands: [
      { cmd: 'reason', desc: 'Run multi-agent reasoning on latest analysis', example: 'recurrsive reason --specialists all' },
      { cmd: 'reason:explain <id>', desc: 'Get a detailed explanation for a finding', example: 'recurrsive reason:explain finding_a1b2c3' },
      { cmd: 'suggest', desc: 'List prioritized improvement opportunities', example: 'recurrsive suggest --top 10 --min-confidence 0.8' },
      { cmd: 'ask <question>', desc: 'Natural language query against the knowledge graph', example: 'recurrsive ask "What are the most coupled modules?"' },
    ],
  },
  {
    name: 'Enterprise',
    icon: Shield,
    color: 'var(--amber)',
    commands: [
      { cmd: 'policy:check', desc: 'Validate against configured quality gate policies', example: 'recurrsive policy:check --fail-on critical' },
      { cmd: 'policy:list', desc: 'List all configured policies and their status', example: 'recurrsive policy:list --format table' },
      { cmd: 'audit:log', desc: 'Export audit log events to stdout or file', example: 'recurrsive audit:log --since 7d --json' },
      { cmd: 'snapshot:create', desc: 'Create a named snapshot of the current analysis', example: 'recurrsive snapshot:create --name "v2.1-release"' },
    ],
  },
  {
    name: 'Utilities',
    icon: Wrench,
    color: 'var(--text-accent)',
    commands: [
      { cmd: 'init', desc: 'Initialize a recurrsive.config.ts in the current directory', example: 'recurrsive init --template monorepo' },
      { cmd: 'doctor', desc: 'Check system requirements and configuration health', example: 'recurrsive doctor' },
      { cmd: 'version', desc: 'Print installed version and check for updates', example: 'recurrsive version --check-updates' },
      { cmd: 'completion', desc: 'Generate shell completion scripts (bash/zsh/fish)', example: 'recurrsive completion --shell zsh >> ~/.zshrc' },
    ],
  },
];

const GLOBAL_FLAGS = [
  { flag: '--format <fmt>', desc: 'Output format: json, table, yaml, html, csv', default: 'table' },
  { flag: '--output <path>', desc: 'Write output to a file instead of stdout', default: 'stdout' },
  { flag: '--verbose', desc: 'Enable verbose logging for debugging', default: 'false' },
  { flag: '--json', desc: 'Shorthand for --format json', default: '-' },
  { flag: '--quiet', desc: 'Suppress all output except errors', default: 'false' },
  { flag: '--config <path>', desc: 'Path to recurrsive.config.ts', default: 'auto-detect' },
  { flag: '--no-color', desc: 'Disable colored output', default: 'false' },
  { flag: '--concurrency <n>', desc: 'Number of parallel analysis workers', default: '4' },
];

export default function CliReferencePage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div className="glow-orb glow-cyan" style={{ width: 500, height: 500, top: -200, left: '50%' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Terminal size={14} /> 25 commands
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">CLI Reference</span>
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
            Automate analysis, query the knowledge graph, generate reports, and manage policies — all from the command line.
          </p>
        </div>
      </section>

      {/* Installation */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>Installation</h2>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Install globally</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="function">$</span> <span className="keyword">npm</span> install -g <span className="string">@recurrsive/cli</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Or run via npx</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="function">$</span> <span className="keyword">npx</span> recurrsive <span className="keyword">--help</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Verify installation</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">recurrsive</span> version
            </div>
          </div>
        </div>
      </section>

      {/* Command Groups */}
      {COMMAND_GROUPS.map((group) => (
        <section
          key={group.name}
          className="section-sm"
          style={{
            background: COMMAND_GROUPS.indexOf(group) % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
          }}
        >
          <div className="container" style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
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
                <h2 style={{ fontSize: '1.4rem' }}>{group.name}</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                  {group.commands.length} commands
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {group.commands.map((c) => (
                <div key={c.cmd} className="glass-card" style={{ padding: 'var(--space-lg)' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.9rem',
                      color: 'var(--text-accent)', marginBottom: 'var(--space-sm)', fontWeight: 600,
                    }}
                  >
                    recurrsive {c.cmd}
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.6 }}>
                    {c.desc}
                  </p>
                  <div
                    className="code-block"
                    style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: '0.82rem' }}
                  >
                    <span className="function">$</span> {c.example}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Global Flags */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Settings size={28} style={{ color: 'var(--text-accent)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Global Flags</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            These flags can be passed to any command.
          </p>
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'grid', gridTemplateColumns: '1fr 2fr 100px',
                gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                background: 'var(--bg-tertiary)', fontWeight: 700, fontSize: '0.82rem',
                color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              <div>Flag</div>
              <div>Description</div>
              <div>Default</div>
            </div>
            {/* Rows */}
            {GLOBAL_FLAGS.map((f, i) => (
              <div
                key={f.flag}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 2fr 100px',
                  gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                  borderTop: '1px solid var(--border-subtle)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--cyan)' }}>
                  {f.flag}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{f.desc}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  {f.default}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Configuration */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Zap size={28} style={{ color: 'var(--amber)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>
              Configuration File
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Create a <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>recurrsive.config.ts</span> in
            your project root. The CLI auto-detects it, or use <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>--config</span> to point elsewhere.
          </p>
          <div className="code-block">
            <div><span className="comment">{'// recurrsive.config.ts'}</span></div>
            <div><span className="keyword">import</span> {'{'} <span className="function">defineConfig</span> {'}'} <span className="keyword">from</span> <span className="string">&apos;@recurrsive/cli&apos;</span>;</div>
            <div style={{ marginTop: 8 }}>
              <span className="keyword">export default</span> <span className="function">defineConfig</span>({'{'}
            </div>
            <div>{'  '}<span className="keyword">root</span>: <span className="string">&apos;.&apos;</span>,</div>
            <div>{'  '}<span className="keyword">analyzers</span>: [<span className="string">&apos;architecture&apos;</span>, <span className="string">&apos;security&apos;</span>, <span className="string">&apos;performance&apos;</span>],</div>
            <div>{'  '}<span className="keyword">exclude</span>: [<span className="string">&apos;node_modules&apos;</span>, <span className="string">&apos;dist&apos;</span>, <span className="string">&apos;.next&apos;</span>],</div>
            <div>{'  '}<span className="keyword">graph</span>: {'{'}
            </div>
            <div>{'    '}<span className="keyword">provider</span>: <span className="string">&apos;sqlite&apos;</span>,</div>
            <div>{'    '}<span className="keyword">path</span>: <span className="string">&apos;./recurrsive.db&apos;</span>,</div>
            <div>{'  '}{'}'}</div>
            <div>{'  '}<span className="keyword">reporting</span>: {'{'}
            </div>
            <div>{'    '}<span className="keyword">format</span>: <span className="string">&apos;html&apos;</span>,</div>
            <div>{'    '}<span className="keyword">outputDir</span>: <span className="string">&apos;./reports&apos;</span>,</div>
            <div>{'  '}{'}'}</div>
            <div>{'  '}<span className="keyword">ci</span>: {'{'}
            </div>
            <div>{'    '}<span className="keyword">failOnSeverity</span>: <span className="string">&apos;critical&apos;</span>,</div>
            <div>{'    '}<span className="keyword">commentOnPR</span>: <span className="keyword">true</span>,</div>
            <div>{'  '}{'}'}</div>
            <div>{'}'});</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ background: 'var(--bg-secondary)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-cyan" style={{ width: 400, height: 400, bottom: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Ready to <span className="text-gradient">Automate?</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            Install the CLI and start analyzing your codebase in under a minute.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="/docs/getting-started" className="btn btn-primary btn-lg">
              Getting Started <ArrowRight size={18} />
            </Link>
            <Link href="/docs/api-reference" className="btn btn-secondary btn-lg">
              API Reference
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
