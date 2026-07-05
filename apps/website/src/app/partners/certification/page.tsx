import type { Metadata } from 'next';
import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Wrench,
  Shield,
  Clock,
  DollarSign,
  Check,
  ArrowRight,
  Sparkles,
  FileText,
  Video,
  Terminal,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Certification Program — Recurrsive',
  description:
    'Validate your Recurrsive expertise with our certification program. Three tracks: Analyst, Architect, and Administrator.',
};

const CERTIFICATIONS = [
  {
    title: 'Recurrsive Analyst',
    icon: BookOpen,
    level: 'Foundation',
    color: 'var(--cyan)',
    audience: 'Engineers & Data Analysts',
    duration: '8 hours self-paced',
    cost: '$199',
    examFormat: '60-question multiple choice exam',
    passingScore: '75%',
    validity: '2 years',
    description:
      'Learn to run analysis workflows, interpret results, build custom dashboards, and communicate engineering intelligence insights to stakeholders.',
    requirements: [
      'Basic understanding of software engineering concepts',
      'Familiarity with command-line tools',
      'Access to a Recurrsive Cloud or self-hosted instance',
    ],
    topics: [
      'Analysis Workflows & CLI',
      'Dashboard Creation',
      'Report Interpretation',
      'KPI Configuration',
      'Stakeholder Communication',
      'Custom Queries',
    ],
  },
  {
    title: 'Recurrsive Architect',
    icon: Wrench,
    level: 'Professional',
    color: 'var(--purple)',
    audience: 'Senior Engineers & Architects',
    duration: '24 hours self-paced',
    cost: '$399',
    examFormat: 'Hands-on lab + architecture review',
    passingScore: '80%',
    validity: '2 years',
    description:
      'Master the Plugin SDK, design custom analyzers, build intelligence packs, and architect enterprise-grade Recurrsive deployments across complex organizations.',
    requirements: [
      'Recurrsive Analyst certification or equivalent experience',
      '3+ years software engineering experience',
      'Familiarity with TypeScript/JavaScript and REST APIs',
    ],
    topics: [
      'Plugin SDK Deep Dive',
      'Custom Analyzer Development',
      'Knowledge Graph Architecture',
      'Integration Design Patterns',
      'Intelligence Pack Authoring',
      'Enterprise Architecture',
    ],
  },
  {
    title: 'Recurrsive Administrator',
    icon: Shield,
    level: 'Expert',
    color: 'var(--amber)',
    audience: 'Platform Engineers & DevOps',
    duration: '16 hours self-paced',
    cost: '$349',
    examFormat: 'Practical deployment assessment',
    passingScore: '80%',
    validity: '2 years',
    description:
      'Deploy, scale, and secure Recurrsive in production environments. Master SSO/SAML integration, RBAC policies, multi-tenant configurations, and performance tuning.',
    requirements: [
      'Experience with container orchestration (Kubernetes/Docker)',
      'Understanding of SSO, SAML, and RBAC concepts',
      'Familiarity with cloud infrastructure (AWS/GCP/Azure)',
    ],
    topics: [
      'Production Deployment',
      'SSO & SAML Integration',
      'RBAC Policy Configuration',
      'Multi-Tenancy Setup',
      'Performance Tuning',
      'Backup & Disaster Recovery',
    ],
  },
];

const RESOURCES = [
  {
    icon: FileText,
    title: 'Study Guides',
    description: 'Comprehensive PDF study guides for each certification track with practice questions and key concepts.',
    color: 'var(--blue)',
  },
  {
    icon: Video,
    title: 'Video Courses',
    description: 'Self-paced video training covering every exam objective with hands-on walkthroughs and demonstrations.',
    color: 'var(--purple)',
  },
  {
    icon: Terminal,
    title: 'Practice Labs',
    description: 'Interactive sandbox environments with pre-configured scenarios to practice real-world Recurrsive tasks.',
    color: 'var(--cyan)',
  },
  {
    icon: Users,
    title: 'Community Forum',
    description: 'Connect with other certification candidates, share study tips, and get answers from certified experts.',
    color: 'var(--green)',
  },
];

export default function CertificationPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
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
              maxWidth: 640,
              margin: '0 auto var(--space-xl)',
              lineHeight: 1.7,
            }}
          >
            Validate your Recurrsive expertise and stand out. Three tracks covering analysis,
            architecture, and platform administration.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2xl)', flexWrap: 'wrap' }}>
            <div>
              <span className="text-gradient" style={{ fontSize: '1.8rem', fontWeight: 800 }}>3</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Certification Tracks</p>
            </div>
            <div>
              <span className="text-gradient" style={{ fontSize: '1.8rem', fontWeight: 800 }}>2,400+</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Certified Professionals</p>
            </div>
            <div>
              <span className="text-gradient" style={{ fontSize: '1.8rem', fontWeight: 800 }}>48 hrs</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Total Coursework</p>
            </div>
          </div>
        </div>
      </section>

      {/* Certification Cards */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Choose Your <span className="text-gradient">Track</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 550, margin: '0 auto', fontSize: '1.05rem' }}>
              Each certification validates specific skills. Start with Analyst and progress through the program.
            </p>
          </div>
          <div className="grid-3">
            {CERTIFICATIONS.map((cert) => (
              <div
                key={cert.title}
                className="glass-card"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-md)',
                  }}
                >
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

                <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>{cert.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                  For {cert.audience}
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  {cert.description}
                </p>

                {/* Details */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginBottom: 'var(--space-md)',
                    padding: 'var(--space-md)',
                    background: 'var(--bg-glass)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Duration</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cert.duration}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Cost</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cert.cost}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Exam</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cert.examFormat}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Validity</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cert.validity}</p>
                  </div>
                </div>

                {/* Requirements */}
                <div style={{ marginBottom: 'var(--space-md)' }}>
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
                    Requirements
                  </p>
                  <ul style={{ listStyle: 'none' }}>
                    {cert.requirements.map((r) => (
                      <li
                        key={r}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          padding: '4px 0',
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <Check size={14} style={{ color: cert.color, flexShrink: 0, marginTop: 2 }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Topics */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: 'var(--space-md)',
                    marginBottom: 'var(--space-lg)',
                    flex: 1,
                  }}
                >
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
                    Topics Covered
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

                <Link href="/partners/apply" className="btn btn-primary" style={{ width: '100%' }}>
                  <GraduationCap size={16} /> Enroll — {cert.cost}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Study Resources */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Study <span className="text-gradient">Resources</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Everything you need to prepare for your certification exam.
            </p>
          </div>
          <div className="grid-4">
            {RESOURCES.map((r) => (
              <div key={r.title} className="glass-card" style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-md)',
                    background: `color-mix(in srgb, ${r.color} 15%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-md)',
                    border: `1px solid color-mix(in srgb, ${r.color} 25%, transparent)`,
                  }}
                >
                  <r.icon size={24} style={{ color: r.color }} />
                </div>
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>{r.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  {r.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: -150, left: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Ready to Get <span className="text-gradient">Certified</span>?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 500,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.1rem',
              lineHeight: 1.7,
            }}
          >
            Start with the Analyst certification and build your expertise from the ground up.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/partners/apply" className="btn btn-primary btn-lg">
              <Sparkles size={18} /> Start Learning
            </Link>
            <Link href="/partners" className="btn btn-secondary btn-lg">
              Partner Program <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
