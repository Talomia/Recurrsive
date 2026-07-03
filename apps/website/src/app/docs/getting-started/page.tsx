import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Rocket,
  CheckCircle2,
  ArrowRight,
  Clock,
  Terminal,
  Package,
  Play,
  Eye,
  Monitor,
  Container,
  BookOpen,
  Code2,
  Puzzle,
  Server,
  Map,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Getting Started — Recurrsive Docs',
  description:
    'Get up and running with Recurrsive in under 5 minutes. Install, analyze, and view results with this quickstart guide.',
};

const PREREQUISITES = [
  { name: 'Node.js', version: '20+', note: 'LTS recommended' },
  { name: 'pnpm', version: '9+', note: 'or npm / yarn' },
  { name: 'Git', version: '2.30+', note: 'for cloning the repository' },
  { name: 'Docker', version: '24+', note: 'optional, for containerized setup' },
];

const NEXT_LINKS = [
  { icon: Code2, title: 'API Reference', desc: 'Explore 150 REST endpoints', href: '/docs/api-reference' },
  { icon: Terminal, title: 'CLI Reference', desc: 'Master 25 CLI commands', href: '/docs/cli-reference' },
  { icon: Puzzle, title: 'Plugin SDK', desc: 'Build custom analyzers', href: '/docs/plugin-sdk' },
  { icon: Server, title: 'Deployment Guide', desc: 'Production setup', href: '/docs/deployment' },
  { icon: Map, title: 'Architecture', desc: 'How it works under the hood', href: '/docs/architecture' },
];

export default function GettingStartedPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -200, left: '20%' }}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="badge badge-green" style={{ marginBottom: 'var(--space-lg)' }}>
            <Clock size={14} /> 5-minute quickstart
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            Get Started with <span className="text-gradient">Recurrsive</span>
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
            Install Recurrsive, run your first analysis, and explore the results — all in under five minutes.
          </p>
        </div>
      </section>

      {/* Prerequisites */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <h2 style={{ marginBottom: 'var(--space-xl)' }}>
            <span className="text-gradient">Prerequisites</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            Before you begin, make sure you have the following tools installed on your machine.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
            {PREREQUISITES.map((req) => (
              <div
                key={req.name}
                className="glass-card"
                style={{ padding: 'var(--space-lg)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}
              >
                <CheckCircle2
                  size={18}
                  style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>
                    {req.name}{' '}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--cyan)' }}>
                      {req.version}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{req.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step 1: Clone & Install */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--gradient-brand)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700, color: 'white',
              }}
            >
              1
            </div>
            <h2 style={{ fontSize: '1.5rem' }}>Clone &amp; Install</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Clone the Recurrsive monorepo and install all dependencies using pnpm.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Clone the repository</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">$</span> <span className="keyword">git</span> clone <span className="string">https://github.com/Talomia/Recurrsive.git</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Enter the project and install dependencies</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">$</span> <span className="keyword">cd</span> Recurrsive && <span className="keyword">pnpm</span> install
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Build all packages</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">pnpm</span> build
            </div>
          </div>
          <div
            className="glass-card"
            style={{
              padding: 'var(--space-md) var(--space-lg)',
              borderLeft: '3px solid var(--amber)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <Package size={18} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Tip:</strong> The monorepo uses{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>pnpm workspaces</span>.
              All packages are linked automatically during install.
            </div>
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* Step 2: First Analysis */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--gradient-brand)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700, color: 'white',
              }}
            >
              2
            </div>
            <h2 style={{ fontSize: '1.5rem' }}>Run Your First Analysis</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Point Recurrsive at any project directory. It will collect evidence, parse source code,
            and produce findings.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Analyze the current directory</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="function">$</span> <span className="keyword">npx</span> recurrsive analyze <span className="string">.</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Example output:</span>
            </div>
            <div style={{ color: 'var(--text-tertiary)' }}>
              <div>✓ Collected 1,247 entities from 3 sources</div>
              <div>✓ Parsed 342 TypeScript files (tree-sitter)</div>
              <div>✓ Executed 89 analysis rules</div>
              <div>✓ Discovered 23 findings across 5 domains</div>
              <div style={{ color: 'var(--green)', marginTop: 8 }}>
                ✓ Analysis complete in 4.2s
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* Step 3: View Results */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--gradient-brand)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700, color: 'white',
              }}
            >
              3
            </div>
            <h2 style={{ fontSize: '1.5rem' }}>View Results</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Generate an HTML report or launch the interactive dashboard to explore findings visually.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Generate an HTML report</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="function">$</span> <span className="keyword">npx</span> recurrsive report <span className="keyword">--format</span> <span className="string">html</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Or launch the interactive dashboard</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">pnpm</span> --filter <span className="string">@recurrsive/dashboard</span> dev
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div
              className="glass-card"
              style={{ flex: 1, minWidth: 200, padding: 'var(--space-lg)', textAlign: 'center' }}
            >
              <Eye size={24} style={{ color: 'var(--text-accent)', marginBottom: 'var(--space-sm)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>HTML Report</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Static, shareable report file
              </div>
            </div>
            <div
              className="glass-card"
              style={{ flex: 1, minWidth: 200, padding: 'var(--space-lg)', textAlign: 'center' }}
            >
              <Monitor size={24} style={{ color: 'var(--cyan)', marginBottom: 'var(--space-sm)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Dashboard</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Interactive graph explorer
              </div>
            </div>
            <div
              className="glass-card"
              style={{ flex: 1, minWidth: 200, padding: 'var(--space-lg)', textAlign: 'center' }}
            >
              <Terminal size={24} style={{ color: 'var(--green)', marginBottom: 'var(--space-sm)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>JSON Output</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Machine-readable for CI/CD
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Docker Quickstart */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Container size={28} style={{ color: 'var(--blue)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>
              Docker <span className="text-gradient">Quickstart</span>
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Prefer containers? Run Recurrsive with a single Docker command — no Node.js required on
            the host.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Pull and run the latest image</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="function">$</span> <span className="keyword">docker</span> run -it --rm \{'\n'}
              {'  '}-v <span className="string">$(pwd):/workspace</span> \{'\n'}
              {'  '}-p <span className="number">3000</span>:<span className="number">3000</span> \{'\n'}
              {'  '}<span className="string">ghcr.io/talomia/recurrsive:latest</span> \{'\n'}
              {'  '}analyze <span className="string">/workspace</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Or use Docker Compose for the full stack</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">docker</span> compose up -d
            </div>
          </div>
          <div
            className="glass-card"
            style={{
              padding: 'var(--space-md) var(--space-lg)',
              borderLeft: '3px solid var(--blue)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <Play size={18} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Docker Compose</strong> includes
              PostgreSQL with Apache AGE, the API server, and the dashboard.
              See the{' '}
              <Link href="/docs/deployment" style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>
                Deployment Guide
              </Link>{' '}
              for the full configuration.
            </div>
          </div>
        </div>
      </section>

      {/* What's Next */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              What&apos;s <span className="text-gradient">Next?</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              Dive deeper into any area of Recurrsive.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--space-md)',
            }}
          >
            {NEXT_LINKS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="glass-card"
                style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', padding: 'var(--space-lg)' }}
              >
                <item.icon size={24} style={{ color: 'var(--text-accent)', marginBottom: 'var(--space-md)' }} />
                <h4 style={{ fontSize: '0.95rem', marginBottom: 4 }}>{item.title}</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', lineHeight: 1.5, flex: 1 }}>
                  {item.desc}
                </p>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-accent)',
                    marginTop: 'var(--space-md)',
                  }}
                >
                  Read guide <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ background: 'var(--bg-secondary)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-blue" style={{ width: 400, height: 400, bottom: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <BookOpen size={32} style={{ color: 'var(--text-accent)', marginBottom: 'var(--space-md)' }} />
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Need Help?
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            Join our community on GitHub Discussions or Slack. We&apos;re here to help you get the most out of Recurrsive.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="https://github.com/Talomia/Recurrsive" className="btn btn-primary btn-lg" target="_blank">
              <Rocket size={18} /> GitHub Repository
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              Back to Docs <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
