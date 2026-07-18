'use client';

import { useState } from 'react';
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
  FileText,
  ExternalLink,
} from 'lucide-react';

const REPO_URL = 'https://github.com/Talomia/Recurrsive';

const QUICK_START = [
  {
    icon: Rocket,
    title: 'Getting Started',
    description: 'Clone and build the monorepo, initialize a project, and run your first local analysis.',
    tag: 'Guide',
    tagColor: 'var(--green)',
    href: '/docs/getting-started',
  },
  {
    icon: Code2,
    title: 'API Reference',
    description: 'The Recurrsive server REST + WebSocket API: analysis, health, projects, and management endpoints.',
    tag: 'Reference',
    tagColor: 'var(--cyan)',
    href: '/docs/api-reference',
  },
  {
    icon: Terminal,
    title: 'CLI Reference',
    description: 'The recurrsive command-line tool — 29 commands for analysis, exploration, and server workflows.',
    tag: 'CLI Tool',
    tagColor: 'var(--purple)',
    href: '/docs/cli-reference',
  },
  {
    icon: Puzzle,
    title: 'Plugin SDK',
    description: 'Extend Recurrsive with custom collectors, analyzers, and reasoning specialists against the real registries.',
    tag: 'Extend',
    tagColor: 'var(--blue)',
    href: '/docs/plugin-sdk',
  },
  {
    icon: Server,
    title: 'Deployment',
    description: 'Self-host Recurrsive with Docker Compose: PostgreSQL + Apache AGE, the API server, and the dashboard.',
    tag: 'Deploy',
    tagColor: 'var(--amber)',
    href: '/docs/deployment',
  },
  {
    icon: Map,
    title: 'Architecture',
    description: 'How the platform fits together: the nine core packages, the apps, and the multi-agent reasoning engine.',
    tag: 'Engine',
    tagColor: 'var(--red)',
    href: '/docs/architecture',
  },
];

// The documentation set: the six guide pages on this site, plus the
// authoritative Markdown docs that live in the repository's `docs/` directory.
const DOC_SECTIONS = [
  {
    category: 'Guides on this site',
    color: 'var(--green)',
    guides: [
      { title: 'Getting Started', href: '/docs/getting-started', external: false },
      { title: 'CLI Reference', href: '/docs/cli-reference', external: false },
      { title: 'API Reference', href: '/docs/api-reference', external: false },
      { title: 'Plugin SDK', href: '/docs/plugin-sdk', external: false },
      { title: 'Deployment', href: '/docs/deployment', external: false },
      { title: 'Architecture', href: '/docs/architecture', external: false },
    ],
  },
  {
    category: 'In the repository (docs/)',
    color: 'var(--cyan)',
    guides: [
      { title: 'GETTING_STARTED.md', href: `${REPO_URL}/blob/main/docs/GETTING_STARTED.md`, external: true },
      { title: 'ARCHITECTURE.md', href: `${REPO_URL}/blob/main/docs/ARCHITECTURE.md`, external: true },
      { title: 'API.md', href: `${REPO_URL}/blob/main/docs/API.md`, external: true },
      { title: 'PLUGIN_SDK.md', href: `${REPO_URL}/blob/main/docs/PLUGIN_SDK.md`, external: true },
      { title: 'DEPLOYMENT.md', href: `${REPO_URL}/blob/main/docs/DEPLOYMENT.md`, external: true },
      { title: 'DEVELOPMENT.md', href: `${REPO_URL}/blob/main/docs/DEVELOPMENT.md`, external: true },
    ],
  },
];

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredQuickStart = QUICK_START.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocSections = DOC_SECTIONS.map((section) => {
    const matchedGuides = section.guides.filter((guide) =>
      guide.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return {
      ...section,
      guides: matchedGuides,
    };
  }).filter((section) => section.guides.length > 0);

  const isSearchEmpty =
    filteredQuickStart.length === 0 &&
    filteredDocSections.length === 0;

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                transition: 'all var(--transition-fast)',
              }}
            />
          </div>
        </div>
      </section>

      {/* Conditional Rendering of Sections */}
      {isSearchEmpty ? (
        <section className="section-sm">
          <div className="container" style={{ maxWidth: 540, textAlign: 'center' }}>
            <div
              className="glass-card animate-fade-in"
              style={{
                padding: 'var(--space-3xl)',
                border: '1px dashed var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-sm)',
              }}
            >
              <BookOpen size={44} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No results found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 'var(--space-md)' }}>
                We couldn&apos;t find any documentation sections matching &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="btn btn-secondary btn-sm"
              >
                Reset Search
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Quick Start Cards */}
          {filteredQuickStart.length > 0 && (
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
                  {filteredQuickStart.map((item) => (
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
          )}

          {/* Documentation index */}
          {filteredDocSections.length > 0 && (
            <section className="section" style={{ background: 'var(--bg-secondary)' }}>
              <div className="container">
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                  <h2 style={{ marginBottom: 'var(--space-md)' }}>
                    All <span className="text-gradient">Docs</span>
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
                    The six guide pages on this site, plus the source-of-truth Markdown docs in the repository.
                  </p>
                </div>
                <div className="grid-2">
                  {filteredDocSections.map((section) => (
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
                              {...(guide.external
                                ? { target: '_blank', rel: 'noopener noreferrer' }
                                : {})}
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
                              {guide.external ? (
                                <ExternalLink size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '12px' }} />
                              ) : (
                                <ArrowRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '12px' }} />
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Code Sample */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Get Started in <span className="text-gradient">Seconds</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: '1.05rem' }}>
              Install the CLI, initialize a project, and run your first analysis.
            </p>
          </div>
          <div className="code-block">
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Clone &amp; build the monorepo (see CLI Reference to run recurrsive)</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">$</span> <span className="keyword">git</span> clone <span className="string">https://github.com/Talomia/Recurrsive.git</span> && <span className="keyword">cd</span> Recurrsive && <span className="keyword">pnpm</span> install && <span className="keyword">pnpm</span> build
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
              <span className="function">$</span> <span className="keyword">recurrsive</span> analyze <span className="string">.</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Generate a shareable HTML report</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">recurrsive</span> report <span className="keyword">--format</span> <span className="string">html</span>
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
            Open a GitHub discussion or file an issue. Our team and community are here to help.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="https://github.com/Talomia/Recurrsive/discussions" className="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={18} /> GitHub Discussions
            </Link>
            <Link href="https://github.com/Talomia/Recurrsive/issues" className="btn btn-secondary btn-lg" target="_blank" rel="noopener noreferrer">
              File an Issue <ArrowRight size={18} />
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
