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
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'Track every release of Recurrsive — new features, improvements, and fixes across the Engineering Intelligence Platform.',
};

const releases = [
  {
    version: 'v0.5.0',
    date: 'July 2026',
    title: 'Marketing, Marketplace & Cloud',
    icon: Globe,
    color: 'var(--purple)',
    latest: true,
    changes: [
      'Marketing website with dark-mode glassmorphism design system',
      'Marketplace for community collectors, analyzers, and integrations',
      'Cloud platform with team management, billing, and usage dashboards',
      'Partner portal for SI and consulting integrations',
      'Automated onboarding flow with guided setup wizard',
      'Public API documentation site with interactive playground',
    ],
  },
  {
    version: 'v0.4.1',
    date: 'July 2026',
    title: 'Stability & Testing',
    icon: Code,
    color: 'var(--blue)',
    latest: false,
    changes: [
      'API modularization — split monolithic router into domain modules',
      '100% component test coverage across all UI components',
      'Docker Compose fixes for ARM64 and rootless container runtimes',
      'Reduced API response times by 40% via query optimization',
      'Fixed knowledge graph edge deduplication in concurrent collection runs',
      'Improved error messages and validation across all API endpoints',
    ],
  },
  {
    version: 'v0.4.0',
    date: 'June 2026',
    title: 'Enterprise Dashboard',
    icon: Rocket,
    color: 'var(--cyan)',
    latest: false,
    changes: [
      'Enterprise landing and pricing pages',
      '45+ dashboard pages covering all analysis domains',
      '138 fully-typed REST API endpoints',
      'Real-time analysis progress with WebSocket streaming',
      'Custom dashboard builder with drag-and-drop widgets',
      'Executive summary PDF export with trend analysis',
    ],
  },
  {
    version: 'v0.3.0',
    date: 'June 2026',
    title: 'Enterprise Features',
    icon: Shield,
    color: 'var(--green)',
    latest: false,
    changes: [
      'SSO via SAML 2.0 and OIDC with auto-provisioning',
      'Role-based access control (RBAC) with custom roles and policies',
      'Audit logging for all data access and configuration changes',
      'Workspace isolation for multi-tenant deployments',
      'Scheduled analysis runs with cron-based configuration',
      'Webhook integrations for Slack, Teams, PagerDuty, and Jira',
    ],
  },
  {
    version: 'v0.2.0',
    date: 'June 2026',
    title: 'Foundation',
    icon: Database,
    color: 'var(--amber)',
    latest: false,
    changes: [
      '14 data collectors — Git, GitHub, npm, Docker, Kubernetes, Terraform, and more',
      '13 analyzers — code quality, dependency risk, architecture, AI pipeline, cost',
      'Knowledge graph with 30+ entity types and relationship mapping',
      'Multi-agent reasoning engine with specialist debate protocol',
      'Evidence-based recommendation system with business-impact scoring',
      'CLI tool for local analysis and CI/CD integration',
    ],
  },
  {
    version: 'v0.1.0',
    date: 'June 2026',
    title: 'Initial Release',
    icon: Server,
    color: 'var(--red)',
    latest: false,
    changes: [
      'Core TypeScript type system with strict domain modeling',
      'Basic static analysis for TypeScript and JavaScript projects',
      'Git history collector with commit, branch, and contributor analysis',
      'Dependency graph builder with vulnerability scanning',
      'PostgreSQL-backed storage with migration framework',
      'Docker Compose development environment',
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
              maxWidth: 520,
              marginInline: 'auto',
              marginTop: 'var(--space-lg)',
            }}
          >
            Every feature, fix, and improvement — tracked and documented. See how Recurrsive
            evolves sprint by sprint.
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
            Want to <span className="text-gradient">Contribute</span>?
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
            Recurrsive is open source under Apache 2.0. Check out the repo, open an issue, or submit
            a pull request.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/recurrsive"
              className="btn btn-primary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Code size={18} /> View on GitHub
            </a>
            <a href="/contact" className="btn btn-secondary btn-lg">
              <Rocket size={18} /> Request a Feature
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
