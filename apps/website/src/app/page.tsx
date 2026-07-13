import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  GitBranch,
  Globe,
  Network,
  Search,
  Shield,
  Terminal,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Recurrsive — Evidence-Based Engineering Intelligence',
  description:
    'Analyze configured repositories, build a knowledge graph, and turn traceable findings into engineering opportunities without invented ROI or synthetic execution.',
  openGraph: {
    title: 'Recurrsive — Evidence-Based Engineering Intelligence',
    description:
      'Self-hosted analysis, knowledge graphs, project-scoped findings, and evidence-linked engineering recommendations.',
    type: 'website',
    url: 'https://recurrsive.dev',
  },
};

const capabilities = [
  {
    icon: Search,
    title: 'Repository analysis',
    detail: 'Collectors and analyzers inspect configured source, documentation, configuration, dependencies, and AI usage.',
  },
  {
    icon: Network,
    title: 'Knowledge graph',
    detail: 'PostgreSQL with Apache AGE stores typed entities and relationships for traversal and impact context.',
  },
  {
    icon: Brain,
    title: 'Specialist reasoning',
    detail: 'Nineteen built-in specialist roles can challenge and synthesize findings while retaining evidence and dissent.',
  },
  {
    icon: Shield,
    title: 'Governed operation',
    detail: 'JWT and API-key authentication, RBAC, audit events, data masking, policies, and encrypted stored secrets.',
  },
  {
    icon: Globe,
    title: 'Multiple interfaces',
    detail: 'Use the dashboard, REST API, WebSocket stream, GraphQL endpoint, CLI, or MCP server.',
  },
  {
    icon: Terminal,
    title: 'Self-hosted deployment',
    detail: 'Run the API, dashboard, website, and PostgreSQL/AGE through Docker or EasyPanel in infrastructure you control.',
  },
];

const guarantees = [
  'Findings retain analyzer, severity, confidence, and evidence references.',
  'Health scores use the same documented formula across API, CLI, dashboard, and MCP.',
  'Project-scoped reads do not silently mix analysis from unrelated repositories.',
  'Forecasts require sufficient history and expose uncertainty instead of inventing trends.',
  'Opportunity effort, risk, and impact stay unknown until evidence supports them.',
  'Unsupported simulation, pull-request generation, tenant isolation, and plugin installation are not advertised as working features.',
];

export default function HomePage() {
  return (
    <>
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          paddingTop: 140,
          paddingBottom: 96,
          minHeight: '88vh',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="glow-orb glow-purple" style={{ width: 600, height: 600, top: '-12%', left: '-10%' }} />
        <div className="glow-orb glow-blue" style={{ width: 520, height: 520, top: '18%', right: '-12%' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <span className="badge badge-accent animate-fade-in" style={{ marginBottom: 'var(--space-lg)' }}>
              <Zap size={14} /> Evidence-Based Engineering Intelligence
            </span>
            <h1 className="animate-fade-in stagger-1" style={{ marginBottom: 'var(--space-lg)' }}>
              Understand what your system shows—
              <span className="text-gradient">without pretending to know more</span>
            </h1>
            <p
              className="animate-fade-in stagger-2"
              style={{
                maxWidth: 700,
                margin: '0 auto var(--space-xl)',
                color: 'var(--text-secondary)',
                fontSize: 'clamp(1.05rem, 2vw, 1.22rem)',
                lineHeight: 1.75,
              }}
            >
              Recurrsive analyzes configured repositories, builds a typed knowledge graph, and presents project-scoped findings and opportunities with traceable evidence. It does not fabricate load tests, pull requests, ROI, or measured impact.
            </p>
            <div className="animate-fade-in stagger-3" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
              <Link href="/docs/getting-started" className="btn btn-primary btn-lg">
                Deploy Recurrsive <ArrowRight size={18} />
              </Link>
              <a href="https://github.com/Talomia/Recurrsive" className="btn btn-secondary btn-lg" target="_blank" rel="noopener noreferrer">
                <GitBranch size={18} /> Inspect the Source
              </a>
            </div>
          </div>

          <div className="animate-fade-in-up stagger-4" style={{ maxWidth: 840, margin: 'var(--space-4xl) auto 0' }}>
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px var(--space-lg)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                recurrsive analyze
              </div>
              <div className="code-block" style={{ border: 0, borderRadius: 0, lineHeight: 1.9 }}>
                <div><span className="comment">$ recurrsive analyze --depth full</span></div>
                <div><span className="keyword">▸ Collect</span> configured repository evidence</div>
                <div><span className="keyword">▸ Analyze</span> deterministic rules and configured AI reasoning</div>
                <div><span className="keyword">▸ Persist</span> project-scoped entities, findings, and history</div>
                <br />
                <div><span className="string">Finding:</span> overlapping authorization paths</div>
                <div><span className="string">Severity:</span> high · <span className="string">Evidence:</span> file and route references</div>
                <div><span className="string">Effort / ROI:</span> unknown until measured by the deploying team</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container">
          <div className="divider-gradient" />
          <div className="grid-4" style={{ padding: 'var(--space-3xl) 0' }}>
            {[
              ['13', 'Built-in analyzers'],
              ['19', 'Specialist roles'],
              ['35', 'MCP tools'],
              ['Live', 'Generated API inventory'],
            ].map(([value, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div className="text-gradient" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800 }}>{value}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="divider-gradient" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto var(--space-3xl)' }}>
            <span className="badge badge-accent">Capabilities</span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>A production surface you can verify</h2>
            <p className="text-secondary" style={{ marginTop: 'var(--space-md)', lineHeight: 1.7 }}>
              Every interface is backed by the same project-scoped state and production PostgreSQL/AGE store.
            </p>
          </div>
          <div className="grid-3">
            {capabilities.map((item) => (
              <article key={item.title} className="glass-card">
                <item.icon size={28} style={{ color: 'var(--text-accent)', marginBottom: 'var(--space-md)' }} />
                <h3 style={{ fontSize: '1.08rem', marginBottom: 'var(--space-sm)' }}>{item.title}</h3>
                <p className="text-secondary" style={{ fontSize: '0.92rem', lineHeight: 1.7 }}>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 940 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span className="badge badge-accent">Product contract</span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>Evidence first, uncertainty visible</h2>
          </div>
          <div className="grid-2">
            {guarantees.map((item) => (
              <div key={item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 3 }} />
                <p className="text-secondary" style={{ lineHeight: 1.65 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-blue" style={{ width: 420, height: 420, bottom: -180, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Run it in infrastructure you control</h2>
          <p className="text-secondary" style={{ maxWidth: 620, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            The repository includes Docker images, health checks, production configuration validation, and an EasyPanel service definition. Operations, domains, firewall policy, and off-host backups remain under the deployment owner&apos;s control.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="/docs/deployment" className="btn btn-primary btn-lg">Deployment Guide <ArrowRight size={18} /></Link>
            <Link href="/security" className="btn btn-secondary btn-lg">Security Model</Link>
          </div>
        </div>
      </section>
    </>
  );
}
