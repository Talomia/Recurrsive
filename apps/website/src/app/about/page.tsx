import type { Metadata } from 'next';
import Link from 'next/link';
import { GitBranch, ShieldCheck, Target } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About',
  description: 'The scope, principles, and current state of the open-source Recurrsive project.',
};

const principles = [
  {
    icon: Target,
    title: 'Evidence before claims',
    text: 'Findings link to analyzer evidence and source locations. Unknown effort, risk, or history stays unknown instead of becoming a polished estimate.',
  },
  {
    icon: ShieldCheck,
    title: 'Self-hosted boundary',
    text: 'A deployment owner controls identity, storage, networking, retention, backups, and availability. Recurrsive does not present itself as a managed cloud service.',
  },
  {
    icon: GitBranch,
    title: 'Inspectable software',
    text: 'The code, deployment definitions, analyzers, tests, and operational documentation live in the public repository under Apache 2.0.',
  },
];

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <span className="badge badge-accent">Open-source project</span>
          <h1 style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
            Engineering intelligence that stays <span className="text-gradient">grounded</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.8 }}>
            Recurrsive analyzes authorized repositories, builds a knowledge graph, records findings,
            and promotes evidence-backed opportunities for human review. The current product is a
            self-hosted open-source stack, not a managed service or an autonomous code-change system.
          </p>
        </div>
      </section>

      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="grid-3">
            {principles.map(({ icon: Icon, title, text }) => (
              <article key={title} className="glass-card">
                <Icon size={26} style={{ color: 'var(--text-accent)' }} />
                <h2 style={{ marginTop: 'var(--space-md)', fontSize: '1.1rem' }}>{title}</h2>
                <p style={{ marginTop: 'var(--space-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 700 }}>
          <h2>Review the project directly</h2>
          <p style={{ margin: 'var(--space-md) auto var(--space-xl)', color: 'var(--text-secondary)' }}>
            Source, issues, releases, and contribution history are the authoritative record of the project.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href="https://github.com/Talomia/Recurrsive">Open GitHub</a>
            <Link className="btn btn-secondary" href="/contact">Contact</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
