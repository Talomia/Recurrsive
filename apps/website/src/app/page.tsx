import type { Metadata } from 'next';
import {
  Zap,
  Brain,
  Shield,
  Puzzle,
  Globe,
  GitBranch,
  ArrowRight,
  Terminal,
  ChevronRight,
  Network,
  Eye,
  Code2,
  MessageSquare,
  Layers,
  Search,
  Lightbulb,
  Workflow,
  Star,
  ExternalLink,
  BarChart3,
  Award,
  TrendingUp,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Recurrsive — Engineering Intelligence Platform',
  description:
    'Understand your entire software system. 12 analyzers, knowledge graph, ' +
    'multi-agent reasoning, and evidence-based recommendations ranked by business impact.',
  openGraph: {
    title: 'Recurrsive — Engineering Intelligence Platform',
    description:
      'From code and architecture to AI components, infrastructure, and costs — ' +
      'get a living digital twin of your software system.',
    type: 'website',
    url: 'https://recurrsive.dev',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Recurrsive — Engineering Intelligence Platform',
    description:
      'Evidence-based engineering recommendations powered by knowledge graphs and multi-agent reasoning.',
  },
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Recurrsive Landing Page — Server Component                               */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* ──────────── HERO ──────────── */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          paddingTop: '120px',
          paddingBottom: '80px',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Animated glow orbs */}
        <div
          className="glow-orb glow-purple"
          style={{ width: 600, height: 600, top: '-10%', left: '-8%' }}
        />
        <div
          className="glow-orb glow-blue"
          style={{ width: 500, height: 500, top: '20%', right: '-10%' }}
        />
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: '-5%', left: '30%' }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: 820,
              margin: '0 auto',
            }}
          >
            {/* Badge */}
            <span
              className="badge badge-accent animate-fade-in"
              style={{ marginBottom: 'var(--space-lg)' }}
            >
              <Zap size={14} />
              Engineering Intelligence Platform
            </span>

            {/* H1 */}
            <h1
              className="animate-fade-in stagger-1"
              style={{ marginBottom: 'var(--space-lg)' }}
            >
              Understand Your{' '}
              <span className="text-gradient">Entire System</span>
            </h1>

            {/* Subtext */}
            <p
              className="animate-fade-in stagger-2"
              style={{
                fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
                color: 'var(--text-secondary)',
                maxWidth: 640,
                lineHeight: 1.7,
                marginBottom: 'var(--space-xl)',
              }}
            >
              Instead of dashboards that surface symptoms, get{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                evidence-backed recommendations
              </strong>{' '}
              ranked by business impact — across code, architecture, AI
              components, infrastructure, and costs.
            </p>

            {/* CTAs */}
            <div
              className="animate-fade-in stagger-3"
              style={{
                display: 'flex',
                gap: 'var(--space-md)',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <a href="/docs/getting-started" className="btn btn-primary btn-lg">
                Get Started Free
                <ArrowRight size={18} />
              </a>
              <a
                href="https://github.com/Talomia/Recurrsive"
                className="btn btn-secondary btn-lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitBranch size={18} />
                View on GitHub
              </a>
            </div>
          </div>

          {/* Mock Terminal */}
          <div
            className="animate-fade-in-up stagger-4"
            style={{
              marginTop: 'var(--space-4xl)',
              maxWidth: 780,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
              }}
            >
              {/* Terminal header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: '12px var(--space-lg)',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#ef4444',
                  }}
                />
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#f59e0b',
                  }}
                />
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#22c55e',
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  recurrsive analyze
                </span>
              </div>
              {/* Terminal body */}
              <div className="code-block" style={{ border: 'none', borderRadius: 0 }}>
                <div>
                  <span className="comment">$ recurrsive analyze --depth full</span>
                </div>
                <br />
                <div>
                  <span className="keyword">{'▸'} Discovery</span>{'   '}
                  <span className="string">160+ endpoints</span>{' · '}
                  <span className="string">42 MCP tools</span>{' · '}
                  <span className="string">12 analyzers</span>
                </div>
                <div>
                  <span className="keyword">{'▸'} Knowledge</span>{'   '}
                  <span className="string">2,847 entities</span>{' · '}
                  <span className="string">5,129 relationships</span>
                </div>
                <div>
                  <span className="keyword">{'▸'} Reasoning</span>{'   '}
                  <span className="function">19 agents deliberating...</span>
                </div>
                <br />
                <div>
                  <span className="keyword">{'✦'} Top Recommendation</span>
                </div>
                <div>
                  {'  '}
                  <span className="string">
                    &quot;Consolidate 3 overlapping auth middlewares into a
                  </span>
                </div>
                <div>
                  {'   '}
                  <span className="string">
                    unified policy layer&quot;
                  </span>
                </div>
                <div>
                  {'  '}Confidence: <span className="number">0.94</span>
                  {'  '}Impact: <span className="number">HIGH</span>
                  {'  '}Evidence: <span className="number">7 sources</span>
                </div>
              </div>
            </div>
            <p
              style={{
                textAlign: 'center',
                fontSize: '0.78rem',
                color: 'var(--text-tertiary)',
                marginTop: 'var(--space-sm)',
              }}
            >
              Illustrative example — numbers shown are a mock-up of the CLI output, not live data.
            </p>
          </div>
        </div>
      </section>

      {/* ──────────── STATS ──────────── */}
      <section className="section-sm">
        <div className="container">
          <div className="divider-gradient" />
          <div
            className="grid-4"
            style={{
              paddingTop: 'var(--space-3xl)',
              paddingBottom: 'var(--space-3xl)',
            }}
          >
            {[
              { value: '160+', label: 'API Endpoints', icon: Globe },
              { value: '42', label: 'MCP Tools', icon: Puzzle },
              { value: '13', label: 'Analyzers', icon: Search },
              { value: '28', label: 'CLI Commands', icon: Terminal },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`animate-fade-in stagger-${i + 1}`}
                style={{ textAlign: 'center' }}
              >
                <stat.icon
                  size={24}
                  style={{ color: 'var(--text-accent)', marginBottom: 'var(--space-sm)' }}
                />
                <div
                  style={{
                    fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                  }}
                >
                  <span className="text-gradient">{stat.value}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div className="divider-gradient" />
        </div>
      </section>

      {/* ──────────── THE PROBLEM ──────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span
              className="badge badge-accent"
              style={{ marginBottom: 'var(--space-md)' }}
            >
              The Problem
            </span>
            <h2>
              Your tools see <span className="text-gradient">fragments</span>,
              not the full picture
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                maxWidth: 600,
                margin: 'var(--space-md) auto 0',
                fontSize: '1.05rem',
              }}
            >
              Each tool captures one dimension. No single tool reasons across all
              of them.
            </p>
          </div>

          <div className="grid-2">
            {[
              {
                icon: Code2,
                tool: 'Code Assistants',
                flaw: 'See code only',
                detail:
                  'They autocomplete syntax but can\'t reason about runtime behavior, infrastructure constraints, or business impact.',
                color: 'var(--purple)',
              },
              {
                icon: Eye,
                tool: 'Observability Platforms',
                flaw: 'See runtime only',
                detail:
                  'They surface metrics and traces but can\'t connect production anomalies back to architectural root causes.',
                color: 'var(--blue)',
              },
              {
                icon: Search,
                tool: 'Static Analyzers',
                flaw: 'Catch syntax only',
                detail:
                  'They find linting violations but miss semantic drift, design decay, and cross-system coupling.',
                color: 'var(--cyan)',
              },
              {
                icon: MessageSquare,
                tool: 'AI Evaluators',
                flaw: 'Track prompts only',
                detail:
                  'They score LLM outputs but can\'t tell you if your AI components are well-integrated or creating hidden tech debt.',
                color: 'var(--amber)',
              },
            ].map((item, i) => (
              <div
                key={item.tool}
                className={`glass-card animate-fade-in-up stagger-${i + 1}`}
                style={{ display: 'flex', gap: 'var(--space-lg)' }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-md)',
                    background: `${item.color}15`,
                    border: `1px solid ${item.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <item.icon size={22} style={{ color: item.color }} />
                </div>
                <div>
                  <h4 style={{ marginBottom: 'var(--space-xs)' }}>
                    {item.tool}{' '}
                    <span
                      style={{
                        color: 'var(--text-tertiary)',
                        fontWeight: 400,
                        fontSize: '0.9em',
                      }}
                    >
                      — {item.flaw}
                    </span>
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="animate-fade-in"
            style={{
              textAlign: 'center',
              marginTop: 'var(--space-3xl)',
              padding: 'var(--space-xl)',
              background: 'var(--gradient-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <p style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              Recurrsive connects{' '}
              <span className="text-gradient">all dimensions</span> into a
              single knowledge graph — then reasons across them.
            </p>
          </div>
        </div>
      </section>

      {/* ──────────── HOW IT WORKS ──────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span
              className="badge badge-accent"
              style={{ marginBottom: 'var(--space-md)' }}
            >
              How It Works
            </span>
            <h2>
              From raw signals to{' '}
              <span className="text-gradient">actionable intelligence</span>
            </h2>
          </div>

          <div className="grid-4">
            {[
              {
                step: '01',
                icon: Layers,
                title: 'Collect',
                desc: 'Ingest code, APIs, configs, runtime traces, AI prompts, cost data, and more through 12 specialized analyzers.',
                color: 'var(--purple)',
              },
              {
                step: '02',
                icon: Network,
                title: 'Understand',
                desc: 'Build a rich knowledge graph with 43 entity types and 43 relationship types. Map every connection in your system.',
                color: 'var(--blue)',
              },
              {
                step: '03',
                icon: Brain,
                title: 'Reason',
                desc: '19 specialist agents debate findings using structured argumentation. Consensus emerges from evidence, not heuristics.',
                color: 'var(--cyan)',
              },
              {
                step: '04',
                icon: TrendingUp,
                title: 'Evolve',
                desc: 'Get ranked recommendations with confidence scores, evidence chains, and expected business impact. Track outcomes over time.',
                color: 'var(--green)',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`glass-card animate-fade-in-up stagger-${i + 1}`}
                style={{
                  textAlign: 'center',
                  position: 'relative',
                  paddingTop: 'var(--space-2xl)',
                }}
              >
                {/* Step number watermark */}
                <span
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 16,
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                    fontWeight: 600,
                  }}
                >
                  {item.step}
                </span>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 'var(--radius-md)',
                    background: `${item.color}15`,
                    border: `1px solid ${item.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-md)',
                  }}
                >
                  <item.icon size={26} style={{ color: item.color }} />
                </div>
                <h3
                  style={{
                    fontSize: '1.2rem',
                    marginBottom: 'var(--space-sm)',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────── KEY FEATURES ──────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span
              className="badge badge-accent"
              style={{ marginBottom: 'var(--space-md)' }}
            >
              Capabilities
            </span>
            <h2>
              Built for <span className="text-gradient">serious engineering</span>
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                maxWidth: 560,
                margin: 'var(--space-md) auto 0',
                fontSize: '1.05rem',
              }}
            >
              Every feature is designed to surface understanding — not just data.
            </p>
          </div>

          <div className="grid-3">
            {[
              {
                icon: Network,
                title: 'Knowledge Graph',
                desc: '43 entity types and 43 relationship types model your entire system topology — from functions to infrastructure.',
                stat: '43 entity types',
                color: 'var(--purple)',
              },
              {
                icon: Brain,
                title: 'Multi-Agent Reasoning',
                desc: '19 specialist agents use structured debate protocols to reach consensus. Arguments are weighted by evidence quality.',
                stat: '19 specialists',
                color: 'var(--blue)',
              },
              {
                icon: Award,
                title: 'Evidence-Backed Recs',
                desc: 'Every recommendation includes confidence scores, evidence chains, and expected impact. No hand-waving.',
                stat: 'Confidence scored',
                color: 'var(--cyan)',
              },
              {
                icon: Shield,
                title: 'Policy Engine',
                desc: 'Define governance-as-code. Enforce architectural constraints, security policies, and quality gates programmatically.',
                stat: 'Governance-as-code',
                color: 'var(--green)',
              },
              {
                icon: Puzzle,
                title: 'Plugin SDK',
                desc: 'Build custom analyzers and collectors. Extend the platform with your domain-specific logic and data sources.',
                stat: 'Fully extensible',
                color: 'var(--amber)',
              },
              {
                icon: Globe,
                title: 'Full API Surface',
                desc: 'REST, WebSocket, GraphQL, MCP protocol, and a full CLI. Integrate with anything in your existing toolchain.',
                stat: '5 interfaces',
                color: 'var(--red)',
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className={`glass-card animate-fade-in-up stagger-${(i % 6) + 1}`}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      background: `${feature.color}15`,
                      border: `1px solid ${feature.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <feature.icon size={22} style={{ color: feature.color }} />
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-tertiary)',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {feature.stat}
                  </span>
                </div>
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>{feature.title}</h4>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────── SAMPLE OUTPUT ──────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span
              className="badge badge-accent"
              style={{ marginBottom: 'var(--space-md)' }}
            >
              <Lightbulb size={14} />
              Sample Output
            </span>
            <h2>
              See what a{' '}
              <span className="text-gradient">recommendation</span> looks like
            </h2>
          </div>

          <div
            className="glass-card animate-fade-in-up"
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: 'var(--space-2xl)',
              borderColor: 'var(--border-accent)',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-sm)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <span className="badge badge-accent">
                <BarChart3 size={13} /> Architecture
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <span
                  className="badge"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                >
                  Severity: High
                </span>
                <span className="badge badge-green">Confidence: 0.94</span>
              </div>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: '1.3rem',
                marginBottom: 'var(--space-md)',
                lineHeight: 1.35,
              }}
            >
              Consolidate overlapping authentication middlewares into a unified
              policy layer
            </h3>

            {/* Description */}
            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-lg)',
                lineHeight: 1.7,
              }}
            >
              Three separate auth middlewares (
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85em',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                jwt-validator
              </code>
              ,{' '}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85em',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                rbac-checker
              </code>
              ,{' '}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85em',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                api-key-guard
              </code>
              ) contain duplicated logic and inconsistent error handling, creating
              security surface area and maintenance overhead.
            </p>

            {/* Evidence */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-sm)',
                }}
              >
                Evidence Chain · 7 sources
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-xs)',
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span>
                  <span className="text-gradient" style={{ fontWeight: 600 }}>
                    ▸
                  </span>{' '}
                  Static analysis: 73% code overlap across 3 modules
                </span>
                <span>
                  <span className="text-gradient" style={{ fontWeight: 600 }}>
                    ▸
                  </span>{' '}
                  Runtime trace: 12ms redundant auth check per request
                </span>
                <span>
                  <span className="text-gradient" style={{ fontWeight: 600 }}>
                    ▸
                  </span>{' '}
                  Security scan: 2 inconsistent token validation paths
                </span>
                <span>
                  <span className="text-gradient" style={{ fontWeight: 600 }}>
                    ▸
                  </span>{' '}
                  Knowledge graph: 14 downstream dependents affected
                </span>
              </div>
            </div>

            {/* Impact */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-lg)',
                flexWrap: 'wrap',
              }}
            >
              {[
                { label: 'Latency', value: '-12ms/req' },
                { label: 'Security surface', value: '-40%' },
                { label: 'Maintenance', value: '-200 LoC' },
              ].map((impact) => (
                <div key={impact.label}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {impact.label}
                  </div>
                  <div
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: 'var(--green)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {impact.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ──────────── OPEN SOURCE CTA ──────────── */}
      <section className="section">
        <div className="container">
          <div
            className="glass-card animate-fade-in"
            style={{
              textAlign: 'center',
              padding: 'var(--space-4xl) var(--space-2xl)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background glow */}
            <div
              className="glow-orb glow-purple"
              style={{
                width: 300,
                height: 300,
                top: '-30%',
                left: '10%',
                opacity: 0.25,
              }}
            />
            <div
              className="glow-orb glow-blue"
              style={{
                width: 250,
                height: 250,
                bottom: '-30%',
                right: '10%',
                opacity: 0.2,
              }}
            />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <span
                className="badge badge-green"
                style={{ marginBottom: 'var(--space-lg)' }}
              >
                <Star size={14} />
                Apache 2.0
              </span>
              <h2 style={{ marginBottom: 'var(--space-md)' }}>
                Fully <span className="text-gradient">open source</span>
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  maxWidth: 540,
                  margin: '0 auto var(--space-xl)',
                  fontSize: '1.05rem',
                  lineHeight: 1.7,
                }}
              >
                Recurrsive is open source under the Apache 2.0 license. Inspect
                every analyzer, extend every agent, and self-host with full
                control. No vendor lock-in. No black boxes.
              </p>
              <a
                href="https://github.com/Talomia/Recurrsive"
                className="btn btn-secondary btn-lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitBranch size={18} />
                Star on GitHub
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────── FINAL CTA ──────────── */}
      <section
        className="section"
        style={{
          background: 'var(--bg-secondary)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          className="glow-orb glow-purple"
          style={{
            width: 500,
            height: 500,
            top: '-40%',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: 0.2,
          }}
        />
        <div
          className="container"
          style={{
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <h2
            className="animate-fade-in"
            style={{ marginBottom: 'var(--space-md)' }}
          >
            Ready to understand{' '}
            <span className="text-gradient">your system</span>?
          </h2>
          <p
            className="animate-fade-in stagger-1"
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 480,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.05rem',
            }}
          >
            Get started in minutes. One command to install, one command to
            analyze.
          </p>
          <div
            className="animate-fade-in stagger-2"
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a href="/docs/getting-started" className="btn btn-primary btn-lg">
              Get Started
              <ArrowRight size={18} />
            </a>
            <a href="/docs" className="btn btn-secondary btn-lg">
              Read the Docs
              <ChevronRight size={18} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
