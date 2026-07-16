import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Check, X, ArrowRight, Sparkles, HelpCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Recurrsive is free and open source under Apache 2.0. Self-host the full platform at no cost. Enterprise support is available on request.',
};

const PLANS = [
  {
    name: 'Open Source',
    price: 'Free',
    period: 'forever',
    desc: 'The complete platform, free to self-host under the Apache 2.0 license.',
    cta: 'Get Started Free',
    ctaHref: 'https://github.com/Talomia/Recurrsive',
    ctaStyle: 'btn-primary',
    badge: 'Apache 2.0',
    features: [
      '14 data collectors',
      '12 built-in analyzers (80+ rules)',
      '19-specialist multi-agent reasoning',
      'Knowledge graph (SQLite + Apache AGE)',
      'CLI with 28 commands',
      'MCP Server (42 tools)',
      'REST + WebSocket API',
      'Plugin SDK for custom extensions',
      'SARIF export & reports',
      'Policy engine',
      'SSO, RBAC & audit logging',
      'Self-host with Docker Compose',
    ],
  },
  {
    name: 'Enterprise Support',
    price: 'Contact us',
    period: '',
    desc: 'Optional paid support for organizations that want help running the open-source platform at scale.',
    cta: 'Contact Us',
    ctaHref: '/contact',
    ctaStyle: 'btn-secondary',
    badge: null,
    features: [
      'Everything in Open Source (same code)',
      'Deployment & upgrade assistance',
      'Guidance on SSO / RBAC / multi-tenant setup',
      'Help writing custom analyzers & policies',
      'Prioritized bug fixes & feature requests',
      'Direct line to the maintainers',
    ],
  },
];

const COMPARISON = [
  { feature: 'Collectors', oss: '14', enterprise: '14' },
  { feature: 'Analyzers', oss: '12 + custom', enterprise: '12 + custom' },
  { feature: 'Multi-agent reasoning', oss: true, enterprise: true },
  { feature: 'Knowledge graph', oss: 'SQLite / Apache AGE', enterprise: 'SQLite / Apache AGE' },
  { feature: 'REST API (160+ endpoints)', oss: true, enterprise: true },
  { feature: 'CLI (28 commands)', oss: true, enterprise: true },
  { feature: 'MCP Server', oss: true, enterprise: true },
  { feature: 'Plugin SDK', oss: true, enterprise: true },
  { feature: 'SSO / SAML', oss: true, enterprise: true },
  { feature: 'RBAC', oss: true, enterprise: true },
  { feature: 'Audit logging', oss: true, enterprise: true },
  { feature: 'Multi-tenant', oss: true, enterprise: true },
  { feature: 'Self-hosted', oss: true, enterprise: true },
  { feature: 'Deployment & upgrade help', oss: false, enterprise: true },
  { feature: 'Prioritized support', oss: 'Community', enterprise: 'Direct' },
];

const FAQS = [
  {
    q: 'Is Recurrsive really free?',
    a: 'Yes. The entire platform is licensed under Apache 2.0 and free to use, self-host, and modify — including features often reserved for paid tiers elsewhere, like SSO, RBAC, and audit logging. There is no proprietary core.',
  },
  {
    q: 'Why no per-seat or per-repository pricing?',
    a: 'The platform is open source and self-hosted, so there is nothing to meter. Connect as many users and repositories as you like — the more of your system you connect, the better the cross-cutting insights.',
  },
  {
    q: 'What is "Enterprise Support"?',
    a: 'It is optional, paid help for running the same open-source software — deployment assistance, configuration guidance, and prioritized fixes. It does not unlock any features; everything is already in the open-source release. Contact us to discuss scope and pricing.',
  },
  {
    q: 'Is there a managed cloud I can pay for?',
    a: 'Not yet. A hosted, managed version is on the roadmap but is not available today. For now, self-hosting with Docker Compose is the way to run Recurrsive.',
  },
  {
    q: 'What do I need to self-host?',
    a: 'Node.js 20+, pnpm, and optionally Docker. The Docker Compose stack brings up PostgreSQL (with Apache AGE), the API server, and the dashboard. See the Getting Started and Deployment guides.',
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
            <Sparkles size={14} /> Free & Open Source
          </span>
          <h1 style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-md)' }} className="animate-fade-in stagger-1">
            Simple, <span className="text-gradient">Honest</span> Pricing
          </h1>
          <p className="text-secondary animate-fade-in stagger-2" style={{ fontSize: '1.15rem', maxWidth: 620, margin: '0 auto' }}>
            The whole platform is free under Apache 2.0. Self-host it at no cost.
            Paid support is available if you want a hand running it.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section style={{ paddingBottom: 'var(--space-4xl)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div className="grid-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: plan.badge ? '1px solid var(--border-accent)' : undefined,
                  boxShadow: plan.badge ? 'var(--shadow-glow)' : undefined,
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
                  {plan.period && <span className="text-secondary" style={{ fontSize: '0.9rem' }}>/ {plan.period}</span>}
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
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
            Feature <span className="text-gradient">Comparison</span>
          </h2>
          <p className="text-secondary" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto var(--space-3xl)' }}>
            Same software either way — Enterprise Support only adds people, not features.
          </p>
          <div style={{ overflowX: 'auto', maxWidth: 760, margin: '0 auto' }}>
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
                  <th style={{ textAlign: 'center', padding: '16px', borderBottom: '1px solid var(--border-medium)', fontWeight: 600, color: 'var(--text-accent)' }}>Enterprise Support</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{row.feature}</td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}><CellValue value={row.oss} /></td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}><CellValue value={row.enterprise} /></td>
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
            Reach out and we&apos;ll help you get Recurrsive running for your team.
          </p>
          <Link href="/contact" className="btn btn-primary btn-lg">
            Contact Us <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
