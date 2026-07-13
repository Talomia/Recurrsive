import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Check, X, ArrowRight, Sparkles,
  HelpCircle, Minus,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Apache-2.0 software with optional production and implementation support. No per-seat or per-repository charges.',
};

const PLANS = [
  {
    name: 'Open Source',
    price: 'Free',
    period: 'forever',
    desc: 'Full platform for individual teams and open-source projects.',
    cta: 'Get Started Free',
    ctaHref: 'https://github.com/Talomia/Recurrsive',
    ctaStyle: 'btn-secondary',
    badge: null,
    features: [
      '14 data collectors',
      '13 built-in analyzers',
      '19-specialist multi-agent reasoning',
      'Knowledge graph (SQLite + AGE)',
      'CLI for analysis and operations',
      'MCP Server integration',
      'REST + WebSocket API',
      'SARIF export & reports',
      'Policy engine',
      'Community support',
    ],
  },
  {
    name: 'Production Support',
    price: 'Custom',
    period: 'per org / year',
    desc: 'Operational guidance for teams running Recurrsive in their own infrastructure.',
    cta: 'Discuss Support',
    ctaHref: '/contact',
    ctaStyle: 'btn-primary',
    badge: 'Most Popular',
    features: [
      'Everything in Open Source',
      'EasyPanel deployment review',
      'Production configuration review',
      'Backup and restore runbooks',
      'Upgrade planning',
      'Security configuration guidance',
      'Architecture and scaling reviews',
      'Response terms defined in your agreement',
      'Named technical contact',
    ],
  },
  {
    name: 'Implementation Services',
    price: 'Custom',
    period: 'per engagement',
    desc: 'Hands-on integration and product adoption for complex engineering environments.',
    cta: 'Plan an Engagement',
    ctaHref: '/contact',
    ctaStyle: 'btn-secondary',
    badge: null,
    features: [
      'Everything in Production Support',
      'Collector and analyzer integration',
      'SSO and identity integration',
      'Custom policies and workflows',
      'CI/CD and webhook integration',
      'Data migration planning',
      'Internal enablement sessions',
      'Acceptance criteria and handoff',
    ],
  },
];

const COMPARISON = [
  { feature: 'Collectors', oss: '14', enterprise: '14', cloud: '14' },
  { feature: 'Analyzers', oss: '13', enterprise: '13 + custom', cloud: '13 + custom' },
  { feature: 'Multi-agent reasoning', oss: true, enterprise: true, cloud: true },
  { feature: 'Knowledge graph', oss: 'SQLite dev / PostgreSQL+AGE prod', enterprise: 'SQLite dev / PostgreSQL+AGE prod', cloud: 'SQLite dev / PostgreSQL+AGE prod' },
  { feature: 'REST + WebSocket API', oss: true, enterprise: true, cloud: true },
  { feature: 'CLI', oss: true, enterprise: true, cloud: true },
  { feature: 'MCP Server', oss: true, enterprise: true, cloud: true },
  { feature: 'SSO / SAML', oss: true, enterprise: true, cloud: true },
  { feature: 'RBAC', oss: true, enterprise: true, cloud: true },
  { feature: 'Audit logging', oss: true, enterprise: true, cloud: true },
  { feature: 'Data masking', oss: true, enterprise: true, cloud: true },
  { feature: 'Air-gapped deployment', oss: true, enterprise: true, cloud: true },
  { feature: 'Deployment review', oss: false, enterprise: true, cloud: true },
  { feature: 'Custom integration delivery', oss: false, enterprise: false, cloud: true },
  { feature: 'Support', oss: 'Community', enterprise: 'Agreement-based', cloud: 'Engagement-based' },
];

const FAQS = [
  {
    q: 'Why no per-seat pricing?',
    a: 'Engineering intelligence gets more valuable when more people use it. Per-seat pricing creates adoption friction and encourages organizations to limit access. We want every engineer to benefit.',
  },
  {
    q: 'Why no per-repository pricing?',
    a: 'The more systems you connect, the better the cross-cutting insights. Per-repo pricing discourages connecting your full landscape, which defeats the purpose of holistic intelligence.',
  },
  {
    q: 'What\'s included in the free tier?',
    a: 'The repository includes collectors, analyzers, reasoning, CLI, MCP server, REST API, and the policy engine under Apache 2.0.',
  },
  {
    q: 'Are product features paywalled?',
    a: 'No. The repository is Apache-2.0 licensed. Paid offerings cover production support and hands-on implementation work, not artificial feature gates.',
  },
  {
    q: 'Do you operate a managed Recurrsive cloud?',
    a: 'Not currently. Production deployments run in infrastructure controlled by the deploying organization, including EasyPanel and Docker environments.',
  },
  {
    q: 'What determines support pricing?',
    a: 'Support is scoped to deployment complexity, response expectations, integrations, and the level of hands-on engineering assistance required.',
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={18} style={{ color: 'var(--green)' }} />;
  if (value === false) return <X size={18} style={{ color: 'var(--text-tertiary)' }} />;
  return <span style={{ fontSize: '0.85rem' }}>{value}</span>;
}

export default function PricingPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-purple" style={{ width: 500, height: 500, top: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative' }}>
          <span className="badge badge-accent animate-fade-in">
            <Sparkles size={14} /> No Per-Seat Pricing
          </span>
          <h1 style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-md)' }} className="animate-fade-in stagger-1">
            Simple, <span className="text-gradient">Transparent</span> Pricing
          </h1>
          <p className="text-secondary animate-fade-in stagger-2" style={{ fontSize: '1.15rem', maxWidth: 600, margin: '0 auto' }}>
            Pay by Decision Scope, not by seat or repository.
            More users and more systems connected means better intelligence for everyone.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section style={{ paddingBottom: 'var(--space-4xl)' }}>
        <div className="container">
          <div className="grid-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: plan.badge === 'Most Popular' ? '1px solid var(--border-accent)' : undefined,
                  boxShadow: plan.badge === 'Most Popular' ? 'var(--shadow-glow)' : undefined,
                }}
              >
                {plan.badge && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -12,
                      right: 20,
                      padding: '4px 14px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--gradient-brand)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'white',
                    }}
                  >
                    {plan.badge}
                  </div>
                )}
                <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-sm)' }}>{plan.name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: 'var(--space-sm)' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{plan.price}</span>
                  <span className="text-secondary" style={{ fontSize: '0.9rem' }}>/ {plan.period}</span>
                </div>
                <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)', lineHeight: 1.6 }}>
                  {plan.desc}
                </p>
                <Link href={plan.ctaHref} className={`btn ${plan.ctaStyle}`} style={{ marginBottom: 'var(--space-xl)' }}>
                  {plan.cta} <ArrowRight size={16} />
                </Link>
                <ul style={{ listStyle: 'none', flex: 1 }}>
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        marginBottom: '12px',
                        fontSize: '0.88rem',
                        color: f.startsWith('Everything') ? 'var(--text-accent)' : 'var(--text-secondary)',
                        fontWeight: f.startsWith('Everything') ? 600 : 400,
                      }}
                    >
                      <Check size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            Feature <span className="text-gradient">Comparison</span>
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px', borderBottom: '1px solid var(--border-medium)', fontWeight: 600 }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '16px', borderBottom: '1px solid var(--border-medium)', fontWeight: 600 }}>Open Source</th>
                  <th style={{ textAlign: 'center', padding: '16px', borderBottom: '1px solid var(--border-medium)', fontWeight: 600, color: 'var(--text-accent)' }}>Production Support</th>
                  <th style={{ textAlign: 'center', padding: '16px', borderBottom: '1px solid var(--border-medium)', fontWeight: 600 }}>Implementation</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{row.feature}</td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}><CellValue value={row.oss} /></td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}><CellValue value={row.enterprise} /></td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}><CellValue value={row.cloud} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container" style={{ maxWidth: 800 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {FAQS.map((faq) => (
              <div key={faq.q} className="glass-card" style={{ padding: 'var(--space-xl)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: 'var(--space-sm)' }}>
                  <HelpCircle size={18} style={{ color: 'var(--text-accent)', flexShrink: 0, marginTop: 2 }} />
                  <h4 style={{ fontSize: '1rem' }}>{faq.q}</h4>
                </div>
                <p className="text-secondary" style={{ fontSize: '0.9rem', lineHeight: 1.7, paddingLeft: 30 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center', background: 'var(--bg-secondary)' }}>
        <div className="container">
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Still have questions?</h2>
          <p className="text-secondary" style={{ marginBottom: 'var(--space-xl)', fontSize: '1.05rem' }}>
            Our team is happy to help you find the right plan for your organization.
          </p>
          <Link href="/contact" className="btn btn-primary btn-lg">
            Contact Us <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
