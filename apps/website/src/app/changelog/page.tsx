import type { Metadata } from 'next';
import {
  History,
  Tag,
  Rocket,
  Server,
  Shield,
  Database,
  Code,
  Globe,
  ExternalLink,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'Release history for Recurrsive — mirrors the CHANGELOG.md in the repository. New features, improvements, and fixes across the platform.',
};

// Highlights mirrored from the repository CHANGELOG.md. For the complete,
// authoritative history see the linked CHANGELOG on GitHub.
const releases = [
  {
    version: 'v0.6.0',
    date: 'Jul 16, 2026',
    title: 'Honesty & Correctness Pass',
    icon: Shield,
    color: 'var(--green)',
    latest: true,
    changes: [
      'Removed the demo-user backdoor (admin/admin) and the ALLOW_DEMO_USERS flag — login authenticates only real store-backed users; first admin via POST /api/v1/setup',
      'JWT hardening: alg-header validation, revocable tokens (jti + logout), enforced password minimums, public /health for liveness probes',
      'No fabricated metrics anywhere: one canonical severity-weighted health score, honest not_analyzed / insufficient_data / unavailable states instead of stand-in numbers',
      'Per-project isolation of analysis state and the knowledge graph; the graph is served on-demand after a restart',
      'Real multi-agent debate: consensus reflects genuine inter-agent agreement, every hypothesis is challenged',
      'Pinned the PostgreSQL + Apache AGE image; docker compose requires a real JWT_SECRET',
    ],
  },
  {
    version: 'v0.5.8',
    date: 'Jul 8, 2026',
    title: 'Dashboard UX/UI Overhaul',
    icon: Globe,
    color: 'var(--purple)',
    latest: false,
    changes: [
      'Sidebar consolidated from 7 sections into 4 collapsible groups (28 items)',
      'Command Palette (⌘K), notifications dropdown, and AI chat slide-out panel',
      'Accessibility pass: scope on table headers, aria-labels, heading hierarchy',
      'New Finding detail and Project detail pages',
      'Shared ErrorBanner and LoadingSkeleton components',
      'Dashboard page count grew from 46 to 48',
    ],
  },
  {
    version: 'v0.5.7',
    date: 'Jul 5, 2026',
    title: 'Real Implementation — Zero Synthetic Data',
    icon: Database,
    color: 'var(--blue)',
    latest: false,
    changes: [
      'Removed all mock/seed data from server routes (marketplace, partners, projects, secrets, and more)',
      'Collectors rewritten to make real API calls (GitHub, GitLab, Sentry, Datadog, Langfuse, and others)',
      'Store-backed user authentication with scrypt password hashing and a first-admin setup wizard',
      'Team invites, self-service password change, and admin password reset',
      'OSS vs ecosystem tier separation via ENABLE_ENTERPRISE / ENABLE_ECOSYSTEM flags',
      'Security hardening: auth middleware added across 13 route files; @fastify/helmet headers',
    ],
  },
  {
    version: 'v0.5.6',
    date: 'Jul 4, 2026',
    title: 'Git URL Analysis & Hardening',
    icon: Shield,
    color: 'var(--cyan)',
    latest: false,
    changes: [
      'Analyze remote repositories by Git URL with shallow clone and automatic cleanup',
      'New dashboard findings and health endpoints backed by real data',
      'Security fixes: command-injection and path-traversal hardening, TOCTOU race fix',
      'Demo credentials disabled in production unless explicitly allowed',
      'Graph provider and parser pipeline resilience fixes for large repositories',
    ],
  },
  {
    version: 'v0.5.0 – v0.5.5',
    date: 'Jul 2–3, 2026',
    title: 'Marketing Site, APIs & OpenAPI',
    icon: Code,
    color: 'var(--green)',
    latest: false,
    changes: [
      'Marketing website with a dark glassmorphism design system',
      'Marketplace and Partner REST APIs (store-backed, no seed data)',
      'OpenAPI 3.1 specification and Swagger UI at /api/docs',
      'GraphQL resolvers wired to live analysis data',
      'Website test suite and CI build verification',
      'EasyPanel one-click deploy configuration',
    ],
  },
  {
    version: 'v0.4.0',
    date: 'Jul 1, 2026',
    title: 'Enterprise Collectors, Analyzers & Reasoning',
    icon: Rocket,
    color: 'var(--amber)',
    latest: false,
    changes: [
      'Expanded to 14 data collectors with enterprise integrations',
      'Expanded to 12 analyzers with 50+ rules',
      '19-specialist multi-agent reasoning engine with a Custom Specialist SDK',
      '138 REST endpoints across 30 route files, plus GraphQL and multi-tenant routes',
      'CLI grew to 25 commands; MCP server to 42 tools',
    ],
  },
  {
    version: 'v0.1.0 – v0.3.0',
    date: 'Jun 2026',
    title: 'Foundation',
    icon: Server,
    color: 'var(--red)',
    latest: false,
    changes: [
      'Core type system, dual-backend knowledge graph (SQLite + PostgreSQL/Apache AGE)',
      'Collector, parser, analyzer, reasoning, policy, and presentation packages',
      'CLI, MCP server, and Fastify REST API applications',
      'Full-text search (FTS5), notifications, batch analysis, audit trail, and analytics',
      'SARIF v2.1.0 and HTML/JSON/Markdown report generation',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', textAlign: 'center' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -150, left: '50%', transform: 'translateX(-50%)', position: 'absolute' }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="badge badge-accent animate-fade-in">
            <History size={14} /> Releases
          </span>
          <h1
            className="animate-fade-in-up stagger-1"
            style={{ marginTop: 'var(--space-lg)', maxWidth: 600, marginInline: 'auto' }}
          >
            <span className="text-gradient">Changelog</span>
          </h1>
          <p
            className="animate-fade-in-up stagger-2"
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.15rem',
              maxWidth: 560,
              marginInline: 'auto',
              marginTop: 'var(--space-lg)',
            }}
          >
            Highlights from each release. These mirror the{' '}
            <a
              href="https://github.com/Talomia/Recurrsive/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}
            >
              CHANGELOG.md
            </a>{' '}
            in the repository, which is the authoritative source.
          </p>
        </div>
      </section>

      {/* ── Release Timeline ──────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 820, marginInline: 'auto' }}>
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: 19,
                top: 0,
                bottom: 0,
                width: 2,
                background:
                  'linear-gradient(to bottom, var(--purple), var(--blue), var(--cyan), var(--green), var(--amber), var(--red), transparent)',
                borderRadius: 1,
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3xl)' }}>
              {releases.map((release) => {
                const Icon = release.icon;
                return (
                  <div key={release.version} style={{ display: 'flex', gap: 'var(--space-xl)', position: 'relative' }}>
                    {/* Dot */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        minWidth: 40,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-primary)',
                        border: `2px solid ${release.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                        boxShadow: `0 0 20px ${release.color}30`,
                      }}
                    >
                      <Icon size={18} style={{ color: release.color }} />
                    </div>

                    {/* Card */}
                    <div className="glass-card" style={{ flex: 1 }}>
                      {/* Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-md)',
                          marginBottom: 'var(--space-md)',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Version badge */}
                        <span
                          className="badge text-mono"
                          style={{
                            background: `${release.color}18`,
                            color: release.color,
                            border: `1px solid ${release.color}35`,
                            fontWeight: 700,
                            fontSize: '0.82rem',
                          }}
                        >
                          <Tag size={12} /> {release.version}
                        </span>
                        {release.latest && (
                          <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>
                            Latest
                          </span>
                        )}
                        <span
                          style={{
                            color: 'var(--text-tertiary)',
                            fontSize: '0.85rem',
                            marginLeft: 'auto',
                          }}
                        >
                          {release.date}
                        </span>
                      </div>

                      <h3
                        style={{
                          fontSize: '1.2rem',
                          marginBottom: 'var(--space-md)',
                        }}
                      >
                        {release.title}
                      </h3>

                      {/* Changes list */}
                      <ul
                        style={{
                          listStyle: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-sm)',
                        }}
                      >
                        {release.changes.map((change, i) => (
                          <li
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 'var(--space-sm)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.92rem',
                              lineHeight: 1.6,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                minWidth: 6,
                                borderRadius: 'var(--radius-full)',
                                background: release.color,
                                marginTop: 8,
                                opacity: 0.7,
                              }}
                            />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ────────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Full <span className="text-gradient">History</span>
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.05rem',
              maxWidth: 520,
              marginInline: 'auto',
              marginBottom: 'var(--space-xl)',
            }}
          >
            Recurrsive is open source under Apache 2.0. Read the complete changelog and follow
            development in the repository.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/Talomia/Recurrsive/blob/main/CHANGELOG.md"
              className="btn btn-primary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={18} /> Full CHANGELOG
            </a>
            <a
              href="https://github.com/Talomia/Recurrsive"
              className="btn btn-secondary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Code size={18} /> View on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
