import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Rocket,
  Code2,
  Terminal,
  Puzzle,
  Server,
  Map,
  ArrowRight,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Shield,
  GitBranch,
  Database,
  Zap,
  Settings,
  Cpu,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Recurrsive documentation — guides, API reference, CLI reference, Plugin SDK, and architecture deep-dives.',
};

const QUICK_START = [
  {
    icon: Rocket,
    title: 'Getting Started',
    description: '5-minute setup guide. Install Recurrsive, connect your repositories, and run your first analysis.',
    tag: '5 min',
    tagColor: 'var(--green)',
    href: '/docs/getting-started',
  },
  {
    icon: Code2,
    title: 'API Reference',
    description: 'Complete REST API documentation with 160+ endpoints covering analysis, policies, and management.',
    tag: '160+ endpoints',
    tagColor: 'var(--blue)',
    href: '/docs/api-reference',
  },
  {
    icon: Terminal,
    title: 'CLI Reference',
    description: 'Command-line interface for automation, scripting, and CI/CD integration with 28 commands.',
    tag: '28 commands',
    tagColor: 'var(--cyan)',
    href: '/docs/cli-reference',
  },
  {
    icon: Puzzle,
    title: 'Plugin SDK',
    description: 'Build custom analyzers, collectors, and intelligence packs with our TypeScript SDK.',
    tag: 'SDK',
    tagColor: 'var(--purple)',
    href: '/docs/plugin-sdk',
  },
  {
    icon: Server,
    title: 'MCP Server',
    description: 'Model Context Protocol server with 42 tools and 21 prompts for AI-powered engineering workflows.',
    tag: '42 tools · 21 prompts',
    tagColor: 'var(--amber)',
    href: '/docs/api-reference',
  },
  {
    icon: Map,
    title: 'Architecture Guide',
    description: 'Deep-dive into Recurrsive internals: knowledge graph, reasoning engine, and analysis pipeline.',
    tag: 'Advanced',
    tagColor: 'var(--red)',
    href: '/docs/architecture',
  },
];

const POPULAR_GUIDES = [
  {
    category: 'Setup & Configuration',
    color: 'var(--green)',
    guides: [
      { title: 'Docker Compose Deployment', duration: '10 min', href: '/docs/deployment' },
      { title: 'Kubernetes Helm Chart', duration: '15 min', href: '/docs/deployment' },
      { title: 'Environment Variables Reference', duration: '5 min', href: '/docs/deployment' },
      { title: 'SSO / SAML Configuration', duration: '12 min', href: '/docs/deployment' },
    ],
  },
  {
    category: 'Analysis & Insights',
    color: 'var(--blue)',
    guides: [
      { title: 'Understanding the Knowledge Graph', duration: '8 min', href: '/docs/architecture' },
      { title: 'Creating Custom Policies', duration: '15 min', href: '/docs/plugin-sdk' },
      { title: 'Interpreting Risk Scores', duration: '6 min', href: '/docs/api-reference' },
      { title: 'Building Executive Dashboards', duration: '12 min', href: '/docs/architecture' },
    ],
  },
  {
    category: 'Integrations',
    color: 'var(--cyan)',
    guides: [
      { title: 'GitHub App Installation', duration: '5 min', href: '/docs/deployment' },
      { title: 'GitLab CI/CD Integration', duration: '10 min', href: '/docs/deployment' },
      { title: 'Slack Notifications Setup', duration: '5 min', href: '/docs/deployment' },
      { title: 'Jira Issue Sync', duration: '8 min', href: '/docs/deployment' },
    ],
  },
  {
    category: 'AI & MCP',
    color: 'var(--purple)',
    guides: [
      { title: 'Connecting to Claude Desktop', duration: '5 min', href: '/docs/api-reference' },
      { title: 'MCP Server Configuration', duration: '10 min', href: '/docs/api-reference' },
      { title: 'Using AI-Powered Queries', duration: '8 min', href: '/docs/cli-reference' },
      { title: 'Custom MCP Prompt Templates', duration: '12 min', href: '/docs/plugin-sdk' },
    ],
  },
];

const API_SECTIONS = [
  { name: 'Authentication', endpoints: 8, icon: Shield },
  { name: 'Analysis', endpoints: 25, icon: BarChart3 },
  { name: 'Repositories', endpoints: 20, icon: GitBranch },
  { name: 'Knowledge Graph', endpoints: 18, icon: Database },
  { name: 'Policies', endpoints: 14, icon: Settings },
  { name: 'Integrations', endpoints: 25, icon: Layers },
  { name: 'MCP Server', endpoints: 32, icon: Cpu },
  { name: 'Admin', endpoints: 20, icon: Zap },
];

export default function DocsPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{
          position: 'relative',
          overflow: 'hidden',
          paddingBottom: 'var(--space-2xl)',
        }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -200, left: '30%' }}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
            <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
              <BookOpen size={14} /> Documentation
            </div>
            <h1 style={{ marginBottom: 'var(--space-md)' }}>
              <span className="text-gradient">Documentation</span>
            </h1>
            <p
              style={{
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                color: 'var(--text-secondary)',
                maxWidth: 560,
                margin: '0 auto',
                lineHeight: 1.7,
              }}
            >
              Everything you need to deploy, configure, and extend Recurrsive.
              From quick start guides to deep-dive architecture docs.
            </p>
          </div>

          {/* Search Bar */}
          <div
            style={{
              maxWidth: 600,
              margin: '0 auto',
              position: 'relative',
            }}
          >
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search documentation…"
              style={{
                width: '100%',
                padding: '16px 24px 16px 50px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                backdropFilter: 'blur(10px)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
            <kbd
              style={{
                position: 'absolute',
                right: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
              }}
            >
              ⌘K
            </kbd>
          </div>
        </div>
      </section>

      {/* Quick Start Cards */}
      <section className="section-sm">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Quick <span className="text-gradient">Start</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              Jump into the area you need. Each guide is designed to get you productive fast.
            </p>
          </div>
          <div className="grid-3">
            {QUICK_START.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="glass-card"
                style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--radius-md)',
                      background: `color-mix(in srgb, ${item.tagColor} 15%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid color-mix(in srgb, ${item.tagColor} 25%, transparent)`,
                    }}
                  >
                    <item.icon size={24} style={{ color: item.tagColor }} />
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: `color-mix(in srgb, ${item.tagColor} 12%, transparent)`,
                      color: item.tagColor,
                      border: `1px solid color-mix(in srgb, ${item.tagColor} 20%, transparent)`,
                    }}
                  >
                    {item.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-sm)' }}>{item.title}</h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.7,
                    flex: 1,
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  {item.description}
                </p>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--text-accent)',
                  }}
                >
                  Read docs <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Guides */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Popular <span className="text-gradient">Guides</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              The most-read guides across our documentation, curated by the community.
            </p>
          </div>
          <div className="grid-2">
            {POPULAR_GUIDES.map((section) => (
              <div key={section.category} className="glass-card">
                <h3
                  style={{
                    fontSize: '1rem',
                    marginBottom: 'var(--space-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: section.color,
                      display: 'inline-block',
                    }}
                  />
                  {section.category}
                </h3>
                <ul style={{ listStyle: 'none' }}>
                  {section.guides.map((guide) => (
                    <li key={guide.title}>
                      <Link
                        href={guide.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 0',
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'color var(--transition-fast)',
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <FileText size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          {guide.title}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.78rem',
                            color: 'var(--text-tertiary)',
                            flexShrink: 0,
                            marginLeft: '12px',
                          }}
                        >
                          <Clock size={12} />
                          {guide.duration}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Sections */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              API <span className="text-gradient">Reference</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              Explore 160+ REST API endpoints across 8 categories. Full request/response examples included.
            </p>
          </div>
          <div className="grid-4">
            {API_SECTIONS.map((section) => (
              <Link
                key={section.name}
                href="/docs/api-reference"
                className="glass-card"
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                <section.icon
                  size={28}
                  style={{
                    color: 'var(--text-accent)',
                    marginBottom: 'var(--space-md)',
                  }}
                />
                <h4 style={{ fontSize: '0.95rem', marginBottom: '4px' }}>{section.name}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  {section.endpoints} endpoints
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Code Sample */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Get Started in <span className="text-gradient">Seconds</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              Install the CLI, connect a repo, and run your first analysis.
            </p>
          </div>
          <div className="code-block">
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Install Recurrsive CLI</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">$</span> <span className="keyword">npm</span> install -g <span className="string">@recurrsive/cli</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Initialize your workspace</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">$</span> <span className="keyword">recurrsive</span> init
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Run your first analysis</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">$</span> <span className="keyword">recurrsive</span> analyze --full
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># View the results</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">recurrsive</span> dashboard --open
            </div>
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-blue"
          style={{ width: 400, height: 400, bottom: -150, left: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Can&apos;t Find What You Need?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 480,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
            }}
          >
            Join our community Slack or open a GitHub discussion. Our team and community are here to help.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="https://github.com/Talomia/Recurrsive" className="btn btn-primary btn-lg" target="_blank">
              <ExternalLink size={18} /> GitHub Discussions
            </Link>
            <Link href="https://github.com/Talomia/Recurrsive/discussions" className="btn btn-secondary btn-lg" target="_blank">
              Join Community Discussions <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        input::placeholder {
          color: var(--text-tertiary);
        }
        input:focus {
          border-color: var(--border-accent) !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1), var(--shadow-md);
        }
      `}</style>
    </div>
  );
}
