import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Handshake,
  ArrowRight,
  GraduationCap,
  Megaphone,
  Rocket,
  Users,
  Github,
  Clock,
  MessageSquare,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Register Partner Interest',
  description:
    'The Recurrsive partner program is not yet open. Register early interest via GitHub or the contact page — no fabricated tiers or revenue-share promises.',
};

// Honest, non-monetary reasons to get involved early. No revenue-share figures
// are promised because no program terms exist yet.
const REASONS = [
  {
    icon: Rocket,
    title: 'Shape the Program',
    description: 'Early interest helps decide what a Recurrsive partner program should actually offer.',
    color: 'var(--amber)',
  },
  {
    icon: GraduationCap,
    title: 'Learn the Platform',
    description: 'Everything is open source today — you can start building expertise before the program launches.',
    color: 'var(--cyan)',
  },
  {
    icon: Megaphone,
    title: 'Stay in the Loop',
    description: 'Be among the first to hear when partner onboarding, materials, or co-marketing become available.',
    color: 'var(--purple)',
  },
  {
    icon: Users,
    title: 'Join the Community',
    description: 'Connect with maintainers and other builders in GitHub Discussions.',
    color: 'var(--blue)',
  },
];

export default function PartnerApplyPage() {
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
            Register <span className="text-gradient">Interest</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 640,
              margin: '0 auto var(--space-lg)',
              lineHeight: 1.7,
            }}
          >
            The partner program isn&apos;t accepting formal applications yet. Rather than collect a
            form that goes nowhere, we point you to real channels where you can express interest and
            hear about updates.
          </p>
          <span className="badge">
            <Clock size={13} /> Program not yet open
          </span>
        </div>
      </section>

      {/* Reasons */}
      <section className="section-sm">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Why <span className="text-gradient">Get Involved</span> Early?
            </h2>
          </div>
          <div className="grid-4">
            {REASONS.map((b) => (
              <div key={b.title} className="glass-card">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    background: `color-mix(in srgb, ${b.color} 15%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 'var(--space-md)',
                    border: `1px solid color-mix(in srgb, ${b.color} 25%, transparent)`,
                  }}
                >
                  <b.icon size={22} style={{ color: b.color }} />
                </div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: 'var(--space-sm)' }}>{b.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to register */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <div className="glass-card" style={{ padding: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <h3 style={{ fontSize: '1.15rem' }}>How to register interest</h3>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <MessageSquare size={22} style={{ color: 'var(--text-accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Start a GitHub Discussion</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  Tell us who you are and how you&apos;d like to partner. This is the fastest way to
                  reach the maintainers and other community members.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <Handshake size={22} style={{ color: 'var(--text-accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Or use the contact page</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  Prefer not to post publicly? Reach out through the{' '}
                  <Link href="/contact" style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>
                    contact page
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
              <a
                href="https://github.com/Talomia/Recurrsive/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <Github size={16} /> Open a Discussion
              </a>
              <Link href="/partners" className="btn btn-secondary">
                Back to Partners <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
