import type { Metadata } from 'next';
import Link from 'next/link';
import { Handshake, Users, ArrowRight, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Partner Directory',
  description:
    'The Recurrsive partner directory is empty — the partner program is not yet open and there are no partners to list.',
};

export default function PartnerDirectoryPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -200, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Handshake size={14} /> Partners
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">Partner Directory</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 620,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            A directory of certified Recurrsive partners will live here once the partner program opens.
          </p>
        </div>
      </section>

      {/* Empty state */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 720 }}>
          <div
            className="glass-card"
            style={{
              textAlign: 'center',
              padding: 'var(--space-3xl)',
              border: '1px dashed var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-sm)',
            }}
          >
            <Users size={44} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }} />
            <span className="badge" style={{ marginBottom: 'var(--space-xs)' }}>
              <Clock size={13} /> Program not yet open
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No partners listed yet</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto var(--space-md)', fontSize: '0.92rem', lineHeight: 1.7 }}>
              The partner program hasn&apos;t opened, so there are no partners to show. When it does,
              certified partners will appear here.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href="/partners" className="btn btn-primary btn-sm">
                Partner Program
              </Link>
              <Link href="/partners/apply" className="btn btn-secondary btn-sm">
                Register Interest <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
