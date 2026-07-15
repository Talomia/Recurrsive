import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Building2,
  Briefcase,
  Cpu,
  Cloud,
  ArrowRight,
  Handshake,
  Github,
  Clock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Partners',
  description:
    'A partner program for Recurrsive is planned but not yet open. Learn who we hope to work with and how to register early interest.',
};

const PARTNER_TYPES = [
  {
    icon: Building2,
    title: 'System Integrators',
    description:
      'Teams that implement Recurrsive as part of larger engineering or platform engagements.',
  },
  {
    icon: Briefcase,
    title: 'Consulting Firms',
    description:
      'Advisors who help organizations make sense of engineering intelligence and act on it.',
  },
  {
    icon: Cpu,
    title: 'Technology Partners',
    description:
      'Builders who create integrations and extensions on top of the Recurrsive platform and Plugin SDK.',
  },
  {
    icon: Cloud,
    title: 'Cloud & Hosting Providers',
    description:
      'Providers interested in offering Recurrsive as a managed or one-click deployment in future.',
  },
];

export default function PartnersPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -200, right: -100 }}
        />
        <div
          className="glow-orb glow-blue"
          style={{ width: 400, height: 400, bottom: -100, left: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Handshake size={14} /> Partner Program
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            Partner with <span className="text-gradient">Recurrsive</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1.05rem, 2.2vw, 1.3rem)',
              color: 'var(--text-secondary)',
              maxWidth: 660,
              margin: '0 auto var(--space-lg)',
              lineHeight: 1.7,
            }}
          >
            We plan to build a partner ecosystem around Recurrsive. The program isn&apos;t open
            yet — there are no partners, tiers, or revenue-share arrangements to announce today.
            This page describes who we hope to work with and how to register interest.
          </p>
          <span className="badge" style={{ marginBottom: 'var(--space-xl)' }}>
            <Clock size={13} /> Program not yet open
          </span>
        </div>
      </section>

      {/* Partner Types */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Who We Hope to <span className="text-gradient">Work With</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', fontSize: '1.05rem' }}>
              Whether you build, advise, or deploy — there may be a place for you when the program opens.
            </p>
          </div>
          <div className="grid-2">
            {PARTNER_TYPES.map((pt) => (
              <div key={pt.title} className="glass-card">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(124, 58, 237, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 'var(--space-md)',
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                  }}
                >
                  <pt.icon size={22} style={{ color: 'var(--text-accent)' }} />
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-sm)' }}>{pt.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.7 }}>
                  {pt.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Register interest */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: -150, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Interested in <span className="text-gradient">Partnering</span>?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 560,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.1rem',
              lineHeight: 1.7,
            }}
          >
            The program isn&apos;t accepting applications yet. If you&apos;d like to be notified when
            it opens, register your interest on GitHub or reach out directly — no commitments,
            no fabricated tiers.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/partners/apply" className="btn btn-primary btn-lg">
              <Handshake size={18} /> Register Interest
            </Link>
            <Link
              href="https://github.com/Talomia/Recurrsive/discussions"
              className="btn btn-secondary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={18} /> Discuss on GitHub <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
