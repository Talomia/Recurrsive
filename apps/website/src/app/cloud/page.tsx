import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Cloud, Database, Lock, Server, ShieldCheck, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Production Deployment',
  description: 'Deploy the complete Recurrsive platform in infrastructure you control using EasyPanel or Docker Compose.',
};

const PRODUCTION_CAPABILITIES = [
  {
    icon: Server,
    title: 'EasyPanel-native',
    description: 'Separate API, dashboard, website, and PostgreSQL/AGE services with HTTPS routing and persistent volumes.',
  },
  {
    icon: Database,
    title: 'Durable project data',
    description: 'Store users, projects, findings, opportunities, audit events, and submissions in your own database.',
  },
  {
    icon: Lock,
    title: 'Fail-closed configuration',
    description: 'Production refuses known secrets, demo accounts, and missing CORS configuration instead of starting insecurely.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    description: 'All non-public API routes require a signed session or API key, with role checks for administrative actions.',
  },
];

const CHECKLIST = [
  'Generate unique PostgreSQL and JWT secrets',
  'Configure the exact dashboard and website origins',
  'Attach persistent database and server-data volumes',
  'Enable HTTPS for every externally reachable service',
  'Complete first-run admin setup through the dashboard',
  'Verify backup, restore, restart recovery, and health probes',
];

export default function CloudPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-purple" style={{ width: 560, height: 560, top: -220, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Cloud size={14} /> Self-hosted production
          </div>
          <h1 style={{ maxWidth: 820, margin: '0 auto var(--space-md)' }}>
            Production intelligence in <span className="text-gradient">infrastructure you control</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: 1.7, maxWidth: 680, margin: '0 auto var(--space-xl)' }}>
            Recurrsive ships as a complete self-hosted stack. Deploy it with EasyPanel or Docker Compose and keep source analysis, evidence, users, and operational data inside your environment.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/docs/deployment" className="btn btn-primary btn-lg">
              <Zap size={18} /> Deployment guide
            </Link>
            <Link href="/contact" className="btn btn-secondary btn-lg">
              Production support <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container">
          <div className="grid-2">
            {PRODUCTION_CAPABILITIES.map((capability) => (
              <article key={capability.title} className="glass-card">
                <capability.icon size={24} style={{ color: 'var(--purple)', marginBottom: 'var(--space-md)' }} />
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>{capability.title}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{capability.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="grid-2" style={{ alignItems: 'center' }}>
            <div>
              <div className="badge badge-accent" style={{ marginBottom: 'var(--space-md)' }}>Production checklist</div>
              <h2 style={{ marginBottom: 'var(--space-md)' }}>A deployment you can verify</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                The repository contains reproducible service definitions and health checks. Infrastructure security, backups, domain ownership, and operational SLAs remain under the deploying organization&apos;s control.
              </p>
            </div>
            <div className="glass-card">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {CHECKLIST.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: 10, padding: '9px 0', color: 'var(--text-secondary)' }}>
                    <Check size={17} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
