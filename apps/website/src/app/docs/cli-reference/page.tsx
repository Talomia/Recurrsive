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
    'Complete command-line interface reference for Recurrsive. 29 commands across 7 groups for analysis, reporting, and automation.',
};

const COMMAND_GROUPS = [
  {
    name: 'Analysis',
    icon: BarChart3,
    color: 'var(--blue)',
    commands: [
      { cmd: 'init', desc: 'Initialize Recurrsive in a project', example: 'recurrsive init' },
      { cmd: 'analyze <path>', desc: 'Run the full Recurrsive analysis pipeline', example: 'recurrsive analyze .' },
      { cmd: 'health', desc: 'Show project health score and maturity breakdown', example: 'recurrsive health' },
      { cmd: 'search <query>', desc: 'Full-text search across the knowledge graph (FTS5)', example: 'recurrsive search "authentication"' },
    ],
  },
  {
    name: 'Data & Reporting',
    icon: FileText,
    color: 'var(--green)',
    commands: [
      { cmd: 'report', desc: 'Generate a report from the latest analysis results', example: 'recurrsive report --format html' },
      { cmd: 'export', desc: 'Export analysis data in various formats', example: 'recurrsive export --format json' },
      { cmd: 'snapshot', desc: 'Export or import knowledge graph snapshots', example: 'recurrsive snapshot export' },
      { cmd: 'comparisons', desc: 'Compare analysis runs side-by-side', example: 'recurrsive comparisons' },
      { cmd: 'analytics', desc: 'View analytics summaries and categories', example: 'recurrsive analytics' },
    ],
  },
  {
    name: 'Knowledge Graph',
    icon: Network,
    color: 'var(--purple)',
    commands: [
      { cmd: 'graph', desc: 'Explore the knowledge graph', example: 'recurrsive graph' },
      { cmd: 'timeline', desc: 'Show intelligence timeline', example: 'recurrsive timeline' },
      { cmd: 'opportunities', desc: 'View and manage opportunities', example: 'recurrsive opportunities' },
    ],
  },
  {
    name: 'Intelligence',
    icon: Brain,
    color: 'var(--cyan)',
    commands: [
      { cmd: 'experiments', desc: 'Manage analysis experiments', example: 'recurrsive experiments' },
      { cmd: 'simulate', desc: 'Run and view simulations', example: 'recurrsive simulate' },
      { cmd: 'forecast', desc: 'View trend forecasts', example: 'recurrsive forecast' },
    ],
  },
  {
    name: 'Governance',
    icon: Shield,
    color: 'var(--amber)',
    commands: [
      { cmd: 'policy', desc: 'Evaluate policy compliance for opportunities', example: 'recurrsive policy' },
      { cmd: 'audit', desc: 'View and search the audit trail', example: 'recurrsive audit' },
      { cmd: 'secrets', desc: 'Manage secrets and view audit logs', example: 'recurrsive secrets' },
      { cmd: 'batch', desc: 'Run batch analysis on multiple projects', example: 'recurrsive batch' },
    ],
  },
  {
    name: 'Platform',
    icon: Wrench,
    color: 'var(--text-accent)',
    commands: [
      { cmd: 'config', desc: 'View, validate, and inspect Recurrsive configuration', example: 'recurrsive config' },
      { cmd: 'webhooks', desc: 'Manage webhook integrations', example: 'recurrsive webhooks' },
      { cmd: 'notifications', desc: 'Manage notification channels (Slack, HTTP, console)', example: 'recurrsive notifications' },
      { cmd: 'plugins', desc: 'Manage and discover plugins', example: 'recurrsive plugins' },
      { cmd: 'projects', desc: 'Manage and compare projects', example: 'recurrsive projects' },
      { cmd: 'cloud', desc: 'Cloud platform insights and status', example: 'recurrsive cloud' },
    ],
  },
  {
    name: 'Auth',
    icon: Shield,
    color: 'var(--green)',
    commands: [
      { cmd: 'login', desc: 'Authenticate with a Recurrsive server', example: 'recurrsive login' },
      { cmd: 'setup', desc: 'Create the first admin user (first-run bootstrap) and log in', example: 'recurrsive setup' },
      { cmd: 'logout', desc: 'Log out and clear stored credentials', example: 'recurrsive logout' },
      { cmd: 'whoami', desc: 'Display the currently authenticated user', example: 'recurrsive whoami' },
    ],
  },
];

const GLOBAL_FLAGS = [
  { flag: '-v, --version', desc: 'Show the installed version', default: '-' },
  { flag: '-p, --project <id>', desc: 'Scope server-backed commands to a project', default: 'active project' },
];

const FORMAT_FLAGS = [
  { flag: 'report --format <fmt>', desc: 'Report format: markdown, html, sarif, json', default: 'markdown' },
  { flag: 'export --format <fmt>', desc: 'Export format: json, csv, markdown', default: 'json' },
  { flag: 'analyze --format <fmt>', desc: 'Output format: markdown, json, sarif', default: 'markdown' },
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
            <Terminal size={14} /> 29 commands
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            The CLI is part of the open-source monorepo and is not published to a package registry.
            Clone and build the repo, then run it with <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>npx</span>{' '}
            or link it globally.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Clone and build the monorepo</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">git</span> clone <span className="string">https://github.com/Talomia/Recurrsive.git</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">cd</span> Recurrsive && <span className="keyword">pnpm</span> install && <span className="keyword">pnpm</span> build
            </div>
            <div style={{ marginTop: 16, marginBottom: 4 }}>
              <span className="comment"># Run the CLI without a global install</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="function">$</span> <span className="keyword">npx</span> --package ./apps/cli recurrsive <span className="keyword">--help</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Or link it globally, then run `recurrsive`</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">pnpm</span> --filter @recurrsive/cli link --global
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
            The CLI has two global flags. Output-format options are per-command, not global — the
            most common ones are listed in the second table.
          </p>
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflowX: 'auto',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'grid', gridTemplateColumns: '1fr 2fr 100px', minWidth: 480,
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
                  display: 'grid', gridTemplateColumns: '1fr 2fr 100px', minWidth: 480,
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

          <h3 style={{ fontSize: '1.1rem', margin: 'var(--space-xl) 0 var(--space-md)' }}>
            Per-Command Format Flags
          </h3>
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflowX: 'auto',
            }}
          >
            <div
              style={{
                display: 'grid', gridTemplateColumns: '1fr 2fr 100px', minWidth: 480,
                gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                background: 'var(--bg-tertiary)', fontWeight: 700, fontSize: '0.82rem',
                color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              <div>Flag</div>
              <div>Description</div>
              <div>Default</div>
            </div>
            {FORMAT_FLAGS.map((f, i) => (
              <div
                key={f.flag}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 2fr 100px', minWidth: 480,
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
            The CLI searches upward from the working directory for{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>.recurrsive/config.json</span>,{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>.recurrsive/config.yaml</span>,{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>.recurrsive/config.yml</span>, or{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>recurrsive.config.json</span> and
            auto-detects the first match. There is no <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>--config</span> flag.
          </p>
          <div className="code-block">
            <div><span className="comment">{'# .recurrsive/config.yaml'}</span></div>
            <div style={{ marginTop: 8 }}><span className="keyword">version</span>: <span className="string">&apos;1&apos;</span></div>
            <div style={{ marginTop: 8 }}><span className="keyword">graph</span>:</div>
            <div>{'  '}<span className="keyword">provider</span>: <span className="string">sqlite</span></div>
            <div style={{ marginTop: 8 }}><span className="keyword">analyzers</span>:</div>
            <div>{'  '}<span className="keyword">enabled</span>: <span className="string">[&apos;*&apos;]</span></div>
            <div style={{ marginTop: 8 }}><span className="keyword">output</span>:</div>
            <div>{'  '}<span className="keyword">format</span>: <span className="string">html</span></div>
            <div>{'  '}<span className="keyword">directory</span>: <span className="string">.recurrsive</span></div>
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
