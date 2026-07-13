import type { Metadata } from 'next';
import Link from 'next/link';
import {
  GitBranch, Github, GitPullRequest, Globe, Cloud, AlertTriangle,
  Activity, Database, Brain, BarChart3, Cpu, Shield, DollarSign,
  FileText, Server, Wrench, Zap, Code, Eye, Lock, Boxes,
  ArrowRight, CheckCircle2, Layers, Network, MessageSquare,
  Terminal, Puzzle, Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Product',
  description: 'Full-system engineering intelligence. From code to production, understand every dimension of your software system.',
};

const PIPELINE_STEPS = [
  {
    icon: Boxes,
    title: 'Collect',
    desc: '14 collectors ingest evidence from Git, GitHub, GitLab, OpenTelemetry, cloud cost APIs, error tracking, APM, AI providers (Langfuse, Arize, Helicone), databases, CI/CD, and more.',
    color: '#7c3aed',
  },
  {
    icon: Layers,
    title: 'Understand',
    desc: 'Tree-sitter parsers extract structure from TypeScript, Python, and Go. 13 analyzers with 89+ rules evaluate architecture, performance, security, cost, AI quality, and more.',
    color: '#3b82f6',
  },
  {
    icon: Brain,
    title: 'Reason',
    desc: '19 specialist AI agents debate recommendations using a multi-agent protocol. Evidence is fused, confidence is calibrated, and consensus drives prioritization.',
    color: '#06b6d4',
  },
  {
    icon: Sparkles,
    title: 'Evolve',
    desc: 'Ranked, evidence-backed opportunities with expected business impact, validation plans, and rollback strategies. Track outcomes and improve over time.',
    color: '#22c55e',
  },
];

const COLLECTORS = [
  { icon: GitBranch, name: 'Git', desc: 'Repository history, commits, branches' },
  { icon: Github, name: 'GitHub', desc: 'PRs, issues, reviews, actions, deployments' },
  { icon: GitPullRequest, name: 'GitLab', desc: 'MRs, issues, pipelines, environments' },
  { icon: Globe, name: 'OpenTelemetry', desc: 'OTLP traces, metrics, spans' },
  { icon: Cloud, name: 'Cloud Cost', desc: 'AWS, GCP, Azure billing & usage' },
  { icon: AlertTriangle, name: 'Error Tracking', desc: 'Sentry, Bugsnag, Rollbar' },
  { icon: Activity, name: 'APM', desc: 'Datadog, New Relic, Grafana Tempo' },
  { icon: Database, name: 'Database', desc: 'SQL, Prisma, Drizzle ORM schemas' },
  { icon: Brain, name: 'Langfuse', desc: 'LLM traces, prompt analytics' },
  { icon: BarChart3, name: 'Arize', desc: 'Model monitoring, drift detection' },
  { icon: DollarSign, name: 'Helicone', desc: 'LLM cost and usage tracking' },
  { icon: Cpu, name: 'CI/CD', desc: 'GitHub Actions, GitLab CI pipelines' },
  { icon: FileText, name: 'Documentation', desc: 'Markdown, JSDoc, docstrings' },
  { icon: Server, name: 'Environment', desc: 'Docker, K8s, configs, secrets' },
];

const ANALYZERS = [
  { name: 'Architecture', desc: 'Coupling, cohesion, layering, circular dependencies', icon: Network },
  { name: 'Performance', desc: 'N+1 queries, unbounded loops, memory leaks', icon: Zap },
  { name: 'Security', desc: 'Injection, auth bypass, secret exposure, OWASP', icon: Shield },
  { name: 'Cost', desc: 'Infrastructure waste, over-provisioning, idle resources', icon: DollarSign },
  { name: 'Data', desc: 'Schema drift, missing indexes, query optimization', icon: Database },
  { name: 'Documentation', desc: 'Coverage gaps, stale docs, missing API docs', icon: FileText },
  { name: 'DevOps', desc: 'CI/CD anti-patterns, deployment risks, infra-as-code', icon: Server },
  { name: 'API Contract', desc: 'Breaking changes, versioning, OpenAPI compliance', icon: Code },
  { name: 'Dependency', desc: 'CVEs, outdated packages, license conflicts', icon: Boxes },
  { name: 'Code Quality', desc: 'Complexity, duplication, dead code, naming', icon: Eye },
  { name: 'Reliability', desc: 'Error handling, retry logic, circuit breakers', icon: Activity },
  { name: 'AI Runtime', desc: 'Prompt quality, token usage, model selection', icon: Brain },
  { name: 'AI Patterns', desc: 'RAG quality, agent loops, tool misuse', icon: Sparkles },
];

export default function ProductPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
          paddingTop: 'var(--space-4xl)',
        }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -100, right: -100 }}
        />
        <div className="container">
          <span className="badge badge-accent animate-fade-in">
            <Sparkles size={14} /> Full-System Intelligence
          </span>
          <h1
            style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}
            className="animate-fade-in stagger-1"
          >
            The <span className="text-gradient">Engineering Intelligence</span> Platform
          </h1>
          <p
            className="text-secondary animate-fade-in stagger-2"
            style={{ fontSize: '1.2rem', maxWidth: 700, margin: '0 auto', lineHeight: 1.7 }}
          >
            Recurrsive builds a knowledge graph of your entire software system —
            code, architecture, AI components, infrastructure, costs, and runtime — then reasons
            across every dimension to deliver evidence-backed recommendations.
          </p>
        </div>
      </section>

      {/* Pipeline */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            How <span className="text-gradient">Recurrsive</span> Works
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-xl)',
            }}
          >
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="glass-card"
                style={{ textAlign: 'center', position: 'relative' }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: `${step.color}20`,
                    border: `1px solid ${step.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-lg)',
                  }}
                >
                  <step.icon size={28} style={{ color: step.color }} />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 12,
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.3rem' }}>{step.title}</h3>
                <p className="text-secondary" style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Collectors */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span className="badge badge-accent">
              <Boxes size={14} /> 14 Collectors
            </span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>
              Ingest Evidence From <span className="text-gradient">Everywhere</span>
            </h2>
            <p className="text-secondary" style={{ marginTop: 'var(--space-sm)', maxWidth: 600, margin: 'var(--space-sm) auto 0' }}>
              Connect your Git repos, cloud providers, AI platforms, databases, and CI/CD pipelines.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 'var(--space-md)',
            }}
          >
            {COLLECTORS.map((c) => (
              <div
                key={c.name}
                className="glass-card"
                style={{ padding: 'var(--space-lg)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}
              >
                <c.icon size={20} style={{ color: 'var(--text-accent)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Analyzers */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span className="badge badge-accent">
              <Eye size={14} /> 13 Analyzers · 89+ Rules
            </span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>
              Deep Analysis Across <span className="text-gradient">Every Dimension</span>
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 'var(--space-md)',
            }}
          >
            {ANALYZERS.map((a) => (
              <div
                key={a.name}
                className="glass-card"
                style={{ padding: 'var(--space-lg)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 8 }}>
                  <a.icon size={18} style={{ color: 'var(--text-accent)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{a.name}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reasoning */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3xl)', alignItems: 'center' }}>
            <div>
              <span className="badge badge-accent">
                <Brain size={14} /> Multi-Agent AI
              </span>
              <h2 style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <span className="text-gradient">19 Specialists</span> Debate Your Recommendations
              </h2>
              <p className="text-secondary" style={{ fontSize: '1rem', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
                Not a single model guessing. Specialized AI agents for architecture, performance,
                security, cost, AI quality, and more — each bringing domain expertise to a structured
                debate protocol. Evidence is fused, conflicts are resolved, and confidence is calibrated.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {['Structured debate with presentation, challenge, and synthesis', 'Cross-domain evidence fusion from configured collectors', 'Recorded reasoning provenance and confidence', 'Evidence-linked recommendations and dissent traces'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card" style={{ padding: 'var(--space-xl)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: 1.8 }}>
                <div style={{ color: 'var(--text-tertiary)' }}>{'// Multi-agent debate protocol'}</div>
                <div><span style={{ color: '#c084fc' }}>Presentation</span> → Each specialist presents evidence</div>
                <div><span style={{ color: '#60a5fa' }}>Challenge</span> → Cross-domain challenges raised</div>
                <div><span style={{ color: '#22d3ee' }}>Synthesis</span> → Evidence fusion & conflict resolution</div>
                <div><span style={{ color: '#86efac' }}>Resolution</span> → Consensus score & ranking</div>
                <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>{'// Example specialists'}</div>
                  {['ArchitectureSpecialist', 'PerformanceSpecialist', 'SecuritySpecialist', 'CostSpecialist', 'AIQualitySpecialist'].map((s) => (
                    <div key={s} style={{ color: '#fbbf24' }}>→ {s}</div>
                  ))}
                  <div style={{ color: 'var(--text-tertiary)' }}>{'// ... +14 more specialists'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API Surface */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2>
              Every <span className="text-gradient">Interface</span> You Need
            </h2>
          </div>
          <div className="grid-3">
            {[
              { icon: Globe, title: 'REST API', stat: 'Generated inventory', desc: 'Project analysis, WebSocket streaming, JWT + API key auth, and RBAC' },
              { icon: Terminal, title: 'CLI', stat: 'Operational client', desc: 'Analyze, graph, report, batch, export, and administer deployments' },
              { icon: Puzzle, title: 'MCP Server', stat: 'Live API-backed tools', desc: 'Model Context Protocol for AI assistant integration' },
              { icon: MessageSquare, title: 'GraphQL', stat: 'Full schema', desc: 'Query your knowledge graph with rich relationship traversal' },
              { icon: Lock, title: 'Enterprise', stat: 'SSO · RBAC · Audit', desc: 'JWT auth, API keys, role-based access, audit logging' },
            ].map((item) => (
              <div key={item.title} className="glass-card" style={{ textAlign: 'center' }}>
                <item.icon size={28} style={{ color: 'var(--text-accent)', marginBottom: 'var(--space-md)' }} />
                <h4 style={{ marginBottom: 4 }}>{item.title}</h4>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: 'var(--cyan)',
                    marginBottom: 'var(--space-sm)',
                  }}
                >
                  {item.stat}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-blue"
          style={{ width: 400, height: 400, bottom: -100, left: '50%', transform: 'translateX(-50%)' }}
        />
        <div className="container" style={{ position: 'relative' }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>
            Ready to <span className="text-gradient">Understand</span> Your System?
          </h2>
          <p className="text-secondary" style={{ fontSize: '1.1rem', marginBottom: 'var(--space-xl)', maxWidth: 500, margin: '0 auto var(--space-xl)' }}>
            Open source. Apache 2.0. Start analyzing in 5 minutes.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)' }}>
            <Link href="/cloud" className="btn btn-primary btn-lg">
              Get Started <ArrowRight size={18} />
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .grid-3 { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
