import type { Metadata } from 'next';
import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Wrench,
  Shield,
  ArrowRight,
  Clock,
  Github,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Certification',
  description:
    'A Recurrsive certification program is planned but not yet available. Here are the tracks we intend to offer.',
};

// Planned tracks. No prices, exam formats, pass rates, or enrolment counts are
// shown because the program does not exist yet.
const PLANNED_TRACKS = [
  {
    title: 'Recurrsive Analyst',
    icon: BookOpen,
    level: 'Foundation',
    color: 'var(--cyan)',
    description:
      'Running analysis workflows, interpreting results, building dashboards, and communicating engineering intelligence to stakeholders.',
    topics: ['Analysis Workflows & CLI', 'Dashboard Creation', 'Report Interpretation', 'Custom Queries'],
  },
  {
    title: 'Recurrsive Architect',
    icon: Wrench,
    level: 'Professional',
    color: 'var(--purple)',
    description:
      'Using the Plugin SDK, designing custom analyzers and intelligence packs, and architecting larger deployments.',
    topics: ['Plugin SDK', 'Custom Analyzers', 'Knowledge Graph', 'Integration Design'],
  },
  {
    title: 'Recurrsive Administrator',
    icon: Shield,
    level: 'Expert',
    color: 'var(--amber)',
    description:
      'Deploying, scaling, and securing Recurrsive in production — SSO/SAML, RBAC, multi-tenant setup, and performance tuning.',
    topics: ['Production Deployment', 'SSO & SAML', 'RBAC Policies', 'Performance Tuning'],
  },
];

export default function CertificationPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-purple"
          style={{ width: 600, height: 600, top: -250, left: '50%', transform: 'translateX(-50%)' }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <GraduationCap size={14} /> Certification
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">Certification Program</span>
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
            A formal certification program is planned but not yet available. There are no exams,
            fees, or certified professionals to report today. Below are the three tracks we intend
            to offer — for now, the open-source docs are the best way to build expertise.
          </p>
          <span className="badge">
            <Clock size={13} /> Not yet available
          </span>
        </div>
      </section>

      {/* Planned tracks */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Planned <span className="text-gradient">Tracks</span>
            </h2>
          </div>
          <div className="grid-3">
            {PLANNED_TRACKS.map((cert) => (
              <div key={cert.title} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--radius-md)',
                      background: `color-mix(in srgb, ${cert.color} 15%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid color-mix(in srgb, ${cert.color} 25%, transparent)`,
                    }}
                  >
                    <cert.icon size={24} style={{ color: cert.color }} />
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: `color-mix(in srgb, ${cert.color} 12%, transparent)`,
                      color: cert.color,
                      border: `1px solid color-mix(in srgb, ${cert.color} 20%, transparent)`,
                    }}
                  >
                    {cert.level}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-sm)' }}>{cert.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 'var(--space-md)', flex: 1 }}>
                  {cert.description}
                </p>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 'var(--space-sm)',
                    }}
                  >
                    Intended Topics
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {cert.topics.map((t) => (
                      <span
                        key={t}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.73rem',
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: -150, left: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Start Learning <span className="text-gradient">Today</span>
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 520,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
            }}
          >
            You don&apos;t need a certificate to master Recurrsive. The documentation and source are
            open — dive in and build real expertise now.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/docs" className="btn btn-primary btn-lg">
              <BookOpen size={18} /> Read the Docs
            </Link>
            <Link
              href="https://github.com/Talomia/Recurrsive"
              className="btn btn-secondary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={18} /> View on GitHub <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
