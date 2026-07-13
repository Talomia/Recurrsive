import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Production release notes for Recurrsive.',
};

const changes = [
  'Default-deny API authentication and least-privilege role enforcement',
  'HttpOnly dashboard sessions and short-lived one-use WebSocket tickets',
  'Explicit project scoping for analysis, history, findings, opportunities, batches, and realtime events',
  'Durable project analysis results and finding lifecycle state',
  'Production PostgreSQL/AGE, CORS, JWT, encryption-key, and secret validation',
  'Runtime-generated API route inventory',
  'Non-root containers, health checks, CI, dependency audit, CodeQL, and Dependabot',
  'Evidence-bounded opportunity promotion and recorded-score trend projection',
  'Removed synthetic simulation, pull-request generation, what-if scoring, and non-isolated tenant management',
  'Self-hosted pricing, deployment, privacy, terms, and security documentation',
];

export default function ChangelogPage() {
  return (
    <main style={{ paddingTop: 'var(--nav-height)' }}>
      <section className="section">
        <div className="container" style={{ maxWidth: 840 }}>
          <span className="badge badge-accent">Current production baseline</span>
          <h1 style={{ marginTop: 'var(--space-lg)' }}>Changelog</h1>
          <p className="text-secondary" style={{ maxWidth: 680 }}>
            Release notes list behavior that exists in the repository. Planned capabilities live in the roadmap and are not presented as shipped features.
          </p>
          <div className="glass-card" style={{ marginTop: 'var(--space-2xl)' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Production hardening release</h2>
            <ul style={{ marginTop: 'var(--space-md)', display: 'grid', gap: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
              {changes.map((change) => <li key={change}>{change}</li>)}
            </ul>
          </div>
          <p style={{ marginTop: 'var(--space-xl)' }}>
            <Link href="/docs/deployment" className="btn btn-primary">Deployment guide</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
