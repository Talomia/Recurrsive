import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Cloud,
  Server,
  RefreshCw,
  ArrowUpCircle,
  Lock,
  Cpu,
  BarChart3,
  Check,
  X,
  Globe,
  ArrowRight,
  Zap,
  Shield,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Recurrsive Cloud',
  description:
    'Engineering Intelligence, managed for you. Deploy Recurrsive in minutes with our fully managed cloud platform.',
};

const BENEFITS = [
  {
    icon: Server,
    title: 'Managed Infrastructure',
    description:
      'Zero-ops deployment with auto-scaling compute, managed databases, and 99.99% uptime SLA. Focus on insights, not infrastructure.',
    color: 'var(--purple)',
  },
  {
    icon: RefreshCw,
    title: 'Continuous Sync',
    description:
      'Real-time repository syncing with sub-minute latency. Every commit, every branch, every PR analyzed automatically.',
    color: 'var(--blue)',
  },
  {
    icon: ArrowUpCircle,
    title: 'Auto Upgrades',
    description:
      'Always on the latest version with zero-downtime rolling upgrades. New analyzers and features delivered weekly.',
    color: 'var(--cyan)',
  },
  {
    icon: Lock,
    title: 'Secure Storage',
    description:
      'SOC 2 Type II certified. AES-256 encryption at rest, TLS 1.3 in transit. Your code never leaves your chosen region.',
    color: 'var(--green)',
  },
  {
    icon: Cpu,
    title: 'GPU-Backed Reasoning',
    description:
      'Dedicated GPU clusters for AI-powered analysis. Deep reasoning about architecture patterns and risk at machine speed.',
    color: 'var(--amber)',
  },
  {
    icon: BarChart3,
    title: 'Executive Dashboards',
    description:
      'Pre-built dashboards for CTOs and VP Engineering. Track engineering health, velocity, and business impact in real time.',
    color: 'var(--red)',
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: '$199',
    period: '/mo',
    description: 'For small teams getting started with engineering intelligence.',
    features: [
      'Up to 10 repositories',
      '5 built-in analyzers',
      '1 million lines of code',
      'Daily sync frequency',
      'Email support',
      'Community Slack access',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$599',
    period: '/mo',
    description: 'For growing teams that need full-system intelligence.',
    features: [
      'Up to 50 repositories',
      'All 13 built-in analyzers',
      '10 million lines of code',
      'Real-time sync',
      'Priority support',
      'Executive dashboards',
      'GPU-backed reasoning',
      'Custom policies',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For organizations with advanced security and scale requirements.',
    features: [
      'Unlimited repositories',
      'All analyzers + custom',
      'Unlimited lines of code',
      'Real-time + webhook sync',
      'Dedicated support engineer',
      'SSO / SAML / SCIM',
      'Dedicated GPU cluster',
      'Custom SLAs & BAAs',
      'On-prem hybrid option',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const COMPARISON = [
  { feature: 'Setup Time', cloud: '5 minutes', selfHosted: '2-4 hours' },
  { feature: 'Infrastructure Management', cloud: 'Fully managed', selfHosted: 'You manage' },
  { feature: 'Upgrades', cloud: 'Automatic', selfHosted: 'Manual' },
  { feature: 'Scaling', cloud: 'Auto-scale', selfHosted: 'Manual provisioning' },
  { feature: 'GPU Access', cloud: 'Included', selfHosted: 'BYO GPU' },
  { feature: 'Security Certifications', cloud: 'SOC 2, ISO 27001', selfHosted: 'Self-managed' },
  { feature: 'Uptime SLA', cloud: '99.99%', selfHosted: 'Self-managed' },
  { feature: 'Support', cloud: 'Priority + dedicated', selfHosted: 'Community' },
];

const REGIONS = [
  { name: 'US East', location: 'Virginia', flag: '🇺🇸', status: 'Available' },
  { name: 'US West', location: 'Oregon', flag: '🇺🇸', status: 'Available' },
  { name: 'EU West', location: 'Frankfurt', flag: '🇪🇺', status: 'Available' },
  { name: 'Asia Pacific', location: 'Singapore', flag: '🇸🇬', status: 'Available' },
];

export default function CloudPage() {
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
        <div
          className="glow-orb glow-blue"
          style={{ width: 400, height: 400, bottom: -150, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Cloud size={14} /> Managed Cloud
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">Recurrsive Cloud</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1.1rem, 2.2vw, 1.35rem)',
              color: 'var(--text-secondary)',
              maxWidth: 640,
              margin: '0 auto var(--space-xl)',
              lineHeight: 1.7,
            }}
          >
            Engineering Intelligence, managed for you. Deploy in minutes, scale effortlessly,
            and let us handle the infrastructure.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="#pricing" className="btn btn-primary btn-lg">
              <Sparkles size={18} /> Start Free 14-Day Trial
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              View Documentation <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Everything You Need, <span className="text-gradient">Nothing to Manage</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 550, margin: '0 auto', fontSize: '1.05rem' }}>
              Recurrsive Cloud eliminates operational overhead so you can focus on what matters — engineering intelligence.
            </p>
          </div>
          <div className="grid-3">
            {BENEFITS.map((b) => (
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
                <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-sm)' }}>{b.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.7 }}>
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Simple, <span className="text-gradient">Transparent Pricing</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Start with a free 14-day trial. No credit card required.
            </p>
          </div>
          <div className="grid-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: plan.highlighted
                    ? '1px solid var(--border-accent)'
                    : undefined,
                  boxShadow: plan.highlighted
                    ? 'var(--shadow-glow)'
                    : undefined,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {plan.highlighted && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: 'var(--gradient-brand)',
                    }}
                  />
                )}
                {plan.highlighted && (
                  <span
                    className="badge badge-accent"
                    style={{ marginBottom: 'var(--space-md)', alignSelf: 'flex-start' }}
                  >
                    Most Popular
                  </span>
                )}
                <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-xs)' }}>{plan.name}</h3>
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{plan.price}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem' }}>{plan.period}</span>
                </div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    marginBottom: 'var(--space-lg)',
                    lineHeight: 1.6,
                  }}
                >
                  {plan.description}
                </p>
                <ul style={{ listStyle: 'none', flex: 1, marginBottom: 'var(--space-lg)' }}>
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 0',
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Check size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="#"
                  className={`btn ${plan.highlighted ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%' }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cloud vs Self-Hosted */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Cloud vs <span className="text-gradient">Self-Hosted</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Recurrsive is open-source. Choose the deployment model that fits your team.
            </p>
          </div>
          <div
            className="glass-card"
            style={{ padding: 0, overflow: 'hidden', maxWidth: 800, margin: '0 auto' }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.92rem',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '16px 24px',
                      color: 'var(--text-tertiary)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Feature
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '16px 24px',
                      fontWeight: 700,
                    }}
                  >
                    <span
                      className="text-gradient"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Cloud size={16} /> Cloud
                    </span>
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '16px 24px',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Server size={16} /> Self-Hosted
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{
                      borderBottom:
                        i < COMPARISON.length - 1
                          ? '1px solid var(--border-subtle)'
                          : undefined,
                    }}
                  >
                    <td
                      style={{
                        padding: '14px 24px',
                        fontWeight: 500,
                      }}
                    >
                      {row.feature}
                    </td>
                    <td
                      style={{
                        padding: '14px 24px',
                        textAlign: 'center',
                        color: 'var(--green)',
                        fontWeight: 500,
                      }}
                    >
                      {row.cloud}
                    </td>
                    <td
                      style={{
                        padding: '14px 24px',
                        textAlign: 'center',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {row.selfHosted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Regions */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Global <span className="text-gradient">Regions</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Deploy close to your team. Your data stays in your chosen region.
            </p>
          </div>
          <div className="grid-4">
            {REGIONS.map((r) => (
              <div key={r.name} className="glass-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>{r.flag}</div>
                <h4 style={{ marginBottom: '4px' }}>{r.name}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                  {r.location}
                </p>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--green)',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--green)',
                      display: 'inline-block',
                    }}
                  />
                  {r.status}
                </span>
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
            Ready to Get Started?
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
            Start your free 14-day trial today. No credit card required. Full access to all features.
          </p>
          <Link href="#" className="btn btn-primary btn-lg">
            <Zap size={18} /> Start Free 14-Day Trial
          </Link>
        </div>
      </section>
    </div>
  );
}
