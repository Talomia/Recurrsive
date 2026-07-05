import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  Award,
  Crown,
  Medal,
  Shield,
  Building2,
  Briefcase,
  Cpu,
  Cloud,
  GraduationCap,
  ChevronRight,
  ArrowRight,
  Star,
  Check,
  Handshake,
  BookOpen,
  Sparkles,
  MapPin,
  Globe,
  Wrench,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Partners',
  description:
    'Join the Recurrsive partner ecosystem. System integrators, consulting firms, and technology partners accelerate engineering intelligence adoption.',
};

const TIERS = [
  {
    name: 'Platinum',
    icon: Crown,
    color: '#c084fc',
    borderColor: 'rgba(192, 132, 252, 0.3)',
    bgColor: 'rgba(192, 132, 252, 0.08)',
    benefits: [
      'Dedicated partner manager',
      'Co-marketing & co-selling',
      'Advanced certification access',
      'Revenue share up to 30%',
      'Early access to roadmap',
      'Joint customer success',
      'Executive sponsorship',
      'Custom integrations support',
    ],
    requirement: '10+ implementations / year',
  },
  {
    name: 'Gold',
    icon: Award,
    color: 'var(--amber)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    benefits: [
      'Partner portal access',
      'Co-marketing opportunities',
      'Standard certification access',
      'Revenue share up to 20%',
      'Quarterly business reviews',
      'Technical enablement',
      'Deal registration',
    ],
    requirement: '5+ implementations / year',
  },
  {
    name: 'Silver',
    icon: Medal,
    color: 'var(--text-secondary)',
    borderColor: 'rgba(160, 160, 176, 0.3)',
    bgColor: 'rgba(160, 160, 176, 0.08)',
    benefits: [
      'Partner directory listing',
      'Training resources access',
      'Basic certification access',
      'Revenue share up to 10%',
      'Community support',
      'Marketing toolkit',
    ],
    requirement: '1+ implementations / year',
  },
];

const PARTNER_TYPES = [
  {
    icon: Building2,
    title: 'System Integrators',
    description:
      'Implement Recurrsive as part of enterprise digital transformation engagements. Access technical enablement, implementation playbooks, and co-delivery support.',
  },
  {
    icon: Briefcase,
    title: 'Consulting Firms',
    description:
      'Offer engineering intelligence advisory services. Help clients optimize engineering organizations with data-driven insights and strategic recommendations.',
  },
  {
    icon: Cpu,
    title: 'Technology Partners',
    description:
      'Build integrations and extensions on the Recurrsive platform. Connect your tools into the engineering intelligence graph for richer analysis.',
  },
  {
    icon: Cloud,
    title: 'Cloud Providers',
    description:
      'Offer Recurrsive as a managed service on your cloud marketplace. Leverage pre-built infrastructure templates and co-sell motions.',
  },
];

const PARTNERS = [
  {
    name: 'CloudForge Consulting',
    type: 'System Integrator',
    tier: 'Platinum',
    tierColor: '#c084fc',
    description:
      'Enterprise cloud migration and modernization. Specializing in deploying Recurrsive across Fortune 500 engineering organizations.',
    implementations: 47,
    specialties: ['Cloud Migration', 'Enterprise Architecture'],
  },
  {
    name: 'DevOps Pro Solutions',
    type: 'Consulting Firm',
    tier: 'Gold',
    tierColor: 'var(--amber)',
    description:
      'DevOps transformation consultancy helping teams adopt engineering intelligence practices and CI/CD optimization.',
    implementations: 23,
    specialties: ['DevOps', 'CI/CD', 'Platform Engineering'],
  },
  {
    name: 'AI Safety Labs',
    type: 'Technology Partner',
    tier: 'Platinum',
    tierColor: '#c084fc',
    description:
      'AI governance and safety platform. Builds compliance extensions for healthcare, finance, and regulated industries.',
    implementations: 31,
    specialties: ['AI Safety', 'Compliance', 'Healthcare'],
  },
  {
    name: 'FinTech Assurance Group',
    type: 'Consulting Firm',
    tier: 'Gold',
    tierColor: 'var(--amber)',
    description:
      'Financial services engineering consultancy. Helping banks and fintechs achieve regulatory compliance through engineering intelligence.',
    implementations: 18,
    specialties: ['FinTech', 'Regulatory', 'Risk Management'],
  },
  {
    name: 'Platform Engineering Co',
    type: 'System Integrator',
    tier: 'Silver',
    tierColor: 'var(--text-secondary)',
    description:
      'Internal developer platform builders. Integrating Recurrsive into golden paths and developer self-service portals.',
    implementations: 12,
    specialties: ['Platform Engineering', 'Developer Experience'],
  },
];

const CERTIFICATIONS = [
  {
    title: 'Recurrsive Analyst',
    icon: BookOpen,
    level: 'Foundation',
    color: 'var(--cyan)',
    duration: '8 hours',
    description:
      'Learn to interpret analysis results, create custom dashboards, and present engineering intelligence insights to stakeholders.',
    topics: ['Dashboard Creation', 'Report Interpretation', 'KPI Configuration', 'Stakeholder Communication'],
  },
  {
    title: 'Recurrsive Architect',
    icon: Wrench,
    level: 'Professional',
    color: 'var(--purple)',
    duration: '24 hours',
    description:
      'Master the Plugin SDK, build custom analyzers, design intelligence packs, and architect enterprise-grade deployments.',
    topics: ['Plugin SDK', 'Custom Analyzers', 'Knowledge Graph', 'Integration Design'],
  },
  {
    title: 'Recurrsive Administrator',
    icon: Shield,
    level: 'Expert',
    color: 'var(--amber)',
    duration: '16 hours',
    description:
      'Deploy, scale, and secure Recurrsive in production environments. Manage policies, access control, and multi-tenant configurations.',
    topics: ['Deployment', 'Security Hardening', 'Multi-tenancy', 'Performance Tuning'],
  },
];

export default function PartnersPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
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
              maxWidth: 640,
              margin: '0 auto var(--space-xl)',
              lineHeight: 1.7,
            }}
          >
            Join a growing ecosystem of system integrators, consulting firms, and technology partners
            delivering engineering intelligence to organizations worldwide.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="#apply" className="btn btn-primary btn-lg">
              <Sparkles size={18} /> Apply to Partner
            </Link>
            <Link href="#directory" className="btn btn-secondary btn-lg">
              View Partners <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Partner Tiers */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Partner <span className="text-gradient">Tiers</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Unlock benefits as you grow your practice. Higher tiers bring greater co-sell opportunities and support.
            </p>
          </div>
          <div className="grid-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: tier.borderColor,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--radius-md)',
                      background: tier.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${tier.borderColor}`,
                    }}
                  >
                    <tier.icon size={24} style={{ color: tier.color }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', color: tier.color }}>{tier.name}</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      {tier.requirement}
                    </p>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', flex: 1, marginBottom: 'var(--space-lg)' }}>
                  {tier.benefits.map((b) => (
                    <li
                      key={b}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '7px 0',
                        fontSize: '0.88rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Check size={15} style={{ color: tier.color, flexShrink: 0 }} />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link href="#apply" className="btn btn-secondary" style={{ width: '100%' }}>
                  Apply for {tier.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Types */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Partner <span className="text-gradient">Types</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Whether you build, advise, or deploy — there&apos;s a place for you in the Recurrsive ecosystem.
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

      {/* Partner Directory */}
      <section id="directory" className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Partner <span className="text-gradient">Directory</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Find a certified partner to help you implement and optimize Recurrsive.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {PARTNERS.map((p) => (
              <div
                key={p.name}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-xl)',
                  flexWrap: 'wrap',
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--gradient-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    color: 'var(--text-accent)',
                    border: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                  }}
                >
                  {p.name.charAt(0)}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>{p.name}</h3>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: `color-mix(in srgb, ${p.tierColor} 15%, transparent)`,
                        color: p.tierColor,
                        border: `1px solid color-mix(in srgb, ${p.tierColor} 25%, transparent)`,
                      }}
                    >
                      {p.tier}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                    {p.type} · {p.implementations} implementations
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
                    {p.description}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    {p.specialties.map((s) => (
                      <span
                        key={s}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                {/* CTA */}
                <Link
                  href="/contact"
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: 'center', flexShrink: 0 }}
                >
                  Contact <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certification Tracks */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Certification <span className="text-gradient">Tracks</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 550, margin: '0 auto', fontSize: '1.05rem' }}>
              Validate your expertise and stand out. Our certification programs cover analysis, architecture, and administration.
            </p>
          </div>
          <div className="grid-3">
            {CERTIFICATIONS.map((cert) => (
              <div key={cert.title} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
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
                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{cert.title}</h3>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-tertiary)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <GraduationCap size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {cert.duration} self-paced
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    marginBottom: 'var(--space-md)',
                    flex: 1,
                  }}
                >
                  {cert.description}
                </p>
                <div
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: 'var(--space-md)',
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apply CTA */}
      <section
        id="apply"
        className="section"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: -150, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Ready to <span className="text-gradient">Partner</span>?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 520,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.1rem',
              lineHeight: 1.7,
            }}
          >
            Join our ecosystem and help organizations unlock the full potential of engineering intelligence. We&apos;ll review your application within 5 business days.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/partners/apply" className="btn btn-primary btn-lg">
              <Handshake size={18} /> Apply to Partner Program
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              Partner Guide <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
