import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Cloud,
  Server,
  Terminal,
  Container,
  Database,
  ArrowRight,
  Check,
  Github,
  Clock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Deployment & Cloud',
  description:
    'Recurrsive is open source and self-hosted with Docker Compose. A fully managed cloud is planned but not yet available.',
};

const SELF_HOST_STEPS = [
  {
    icon: Github,
    title: 'Clone the repository',
    description:
      'Everything is open source under Apache 2.0. Clone the monorepo and install dependencies with pnpm.',
    color: 'var(--purple)',
  },
  {
    icon: Container,
    title: 'Bring up the stack',
    description:
      'A single docker compose up -d starts PostgreSQL (with Apache AGE), the API server, and the dashboard.',
    color: 'var(--blue)',
  },
  {
    icon: Terminal,
    title: 'Run an analysis',
    description:
      'Point the CLI at any repository. Findings, the knowledge graph, and reports are generated locally — your code stays on your infrastructure.',
    color: 'var(--cyan)',
  },
  {
    icon: Database,
    title: 'Own your data',
    description:
      'Self-hosting means the knowledge graph and analysis history live in your own database. No data leaves your environment.',
    color: 'var(--green)',
  },
];

export default function CloudPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-purple"
          style={{ width: 600, height: 600, top: -250, left: '50%', transform: 'translateX(-50%)' }}
        />
        <div
          className="glow-orb glow-blue"
          style={{ width: 400, height: 400, bottom: -150, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Server size={14} /> Deployment
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            Deploy <span className="text-gradient">Recurrsive</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1.1rem, 2.2vw, 1.35rem)',
              color: 'var(--text-secondary)',
              maxWidth: 660,
              margin: '0 auto var(--space-xl)',
              lineHeight: 1.7,
            }}
          >
            Recurrsive is open source and runs entirely on your own infrastructure. Self-host the
            full platform with Docker Compose — no account, no license key, no data leaving your
            environment.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/docs/deployment" className="btn btn-primary btn-lg">
              <Container size={18} /> Deployment Guide
            </Link>
            <Link
              href="https://github.com/Talomia/Recurrsive"
              className="btn btn-secondary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={18} /> View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Self-host steps */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Self-Hosting is the <span className="text-gradient">Real Deployment Path</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', fontSize: '1.05rem' }}>
              The entire platform — collectors, analyzers, reasoning engine, API, and dashboard — is
              designed to run locally or on infrastructure you control.
            </p>
          </div>
          <div className="grid-4">
            {SELF_HOST_STEPS.map((b) => (
              <div key={b.title} className="glass-card">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-md)',
                    background: `color-mix(in srgb, ${b.color} 15%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 'var(--space-md)',
                    border: `1px solid color-mix(in srgb, ${b.color} 25%, transparent)`,
                  }}
                >
                  <b.icon size={24} style={{ color: b.color }} />
                </div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>{b.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.7 }}>
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quickstart code */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              One Command to <span className="text-gradient">Get Running</span>
            </h2>
          </div>
          <div className="code-block">
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Clone and start the full stack</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">git</span> clone{' '}
              <span className="string">https://github.com/Talomia/Recurrsive.git</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">cd</span> Recurrsive/docker
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="function">$</span> <span className="keyword">docker</span> compose up -d
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># API on :3000, dashboard on :3100</span>
            </div>
            <div>
              <span className="function">$</span> <span className="keyword">open</span>{' '}
              <span className="string">http://localhost:3100</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: 'var(--space-md)', textAlign: 'center' }}>
            See the{' '}
            <Link href="/docs/deployment" style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>
              Deployment Guide
            </Link>{' '}
            for configuration, environment variables, and production hardening.
          </p>
        </div>
      </section>

      {/* Managed cloud — not yet available */}
      <section className="section">
        <div className="container">
          <div
            className="glass-card"
            style={{
              maxWidth: 760,
              margin: '0 auto',
              textAlign: 'center',
              padding: 'var(--space-3xl) var(--space-2xl)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-md)',
                background: 'var(--gradient-subtle)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-lg)',
              }}
            >
              <Cloud size={26} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <span className="badge" style={{ marginBottom: 'var(--space-md)' }}>
              <Clock size={13} /> Not yet available
            </span>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              A Managed Cloud is <span className="text-gradient">Planned</span>
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1.05rem',
                lineHeight: 1.7,
                maxWidth: 560,
                margin: '0 auto var(--space-lg)',
              }}
            >
              A fully managed, hosted version of Recurrsive is on the roadmap but is not offered
              today. There is no cloud sign-up, subscription, trial, or uptime commitment yet — and
              we will not advertise certifications or SLAs until a real service exists. For now,
              self-hosting is the way to run Recurrsive.
            </p>
            <ul
              style={{
                listStyle: 'none',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '8px',
                textAlign: 'left',
                marginBottom: 'var(--space-lg)',
              }}
            >
              {[
                'Available now: self-hosted via Docker Compose',
                'Planned: managed hosting and automatic upgrades',
                'Want it sooner? Open a GitHub discussion to register interest',
              ].map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  <Check size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/docs/getting-started" className="btn btn-primary">
                Get Started Self-Hosting <ArrowRight size={16} />
              </Link>
              <Link
                href="https://github.com/Talomia/Recurrsive/discussions"
                className="btn btn-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={16} /> Register Interest
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
