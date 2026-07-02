import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CreditCard,
  Receipt,
  TrendingUp,
  ArrowRight,
  Check,
  Download,
  Zap,
  BarChart3,
  Database,
  Cpu,
  Brain,
  Shield,
  ArrowUpCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Billing & Usage — Recurrsive Cloud',
  description:
    'Manage your Recurrsive Cloud subscription, view usage breakdowns, and download invoices.',
};

const USAGE_ITEMS = [
  {
    icon: BarChart3,
    label: 'API Calls',
    used: '1,247,382',
    limit: '5,000,000',
    pct: 25,
    color: 'var(--purple)',
  },
  {
    icon: Cpu,
    label: 'Analysis Runs',
    used: '1,893',
    limit: '10,000',
    pct: 19,
    color: 'var(--blue)',
  },
  {
    icon: Database,
    label: 'Storage',
    used: '42.7 GB',
    limit: '100 GB',
    pct: 43,
    color: 'var(--cyan)',
  },
  {
    icon: Brain,
    label: 'Reasoning Tokens',
    used: '812,403',
    limit: '2,000,000',
    pct: 41,
    color: 'var(--amber)',
  },
];

const INVOICES = [
  { id: 'INV-2026-06', date: 'Jun 1, 2026', amount: '$599.00', status: 'Paid', statusColor: 'var(--green)' },
  { id: 'INV-2026-05', date: 'May 1, 2026', amount: '$599.00', status: 'Paid', statusColor: 'var(--green)' },
  { id: 'INV-2026-04', date: 'Apr 1, 2026', amount: '$599.00', status: 'Paid', statusColor: 'var(--green)' },
];

const PLAN_FEATURES = [
  'Up to 50 repositories',
  'All 13 built-in analyzers',
  '10 million lines of code',
  'Real-time sync',
  'Priority support',
  'Executive dashboards',
  'GPU-backed reasoning',
  'Custom policies',
];

export default function CloudBillingPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -200, left: '50%', transform: 'translateX(-50%)' }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Receipt size={14} /> Billing
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">Billing &amp; Usage</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 560,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Manage your subscription, track usage, and download invoices.
          </p>
        </div>
      </section>

      {/* Current Plan */}
      <section className="section-sm">
        <div className="container">
          <div className="grid-2">
            {/* Plan Card */}
            <div
              className="glass-card"
              style={{
                border: '1px solid var(--border-accent)',
                boxShadow: 'var(--shadow-glow)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <span className="badge badge-accent">Current Plan</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                  Renews Jul 1, 2026
                </span>
              </div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>Growth</h2>
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>$599</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem' }}>/mo</span>
              </div>
              <ul style={{ listStyle: 'none', marginBottom: 'var(--space-lg)' }}>
                {PLAN_FEATURES.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 0',
                      fontSize: '0.88rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Check size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Link href="/cloud#pricing" className="btn btn-primary" style={{ flex: 1 }}>
                  <ArrowUpCircle size={16} /> Upgrade
                </Link>
                <Link href="/cloud#pricing" className="btn btn-secondary" style={{ flex: 1 }}>
                  Change Plan
                </Link>
              </div>
            </div>

            {/* Payment Method */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-lg)' }}>Payment Method</h3>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    padding: 'var(--space-md)',
                    background: 'var(--bg-glass)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--gradient-brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CreditCard size={20} style={{ color: 'white' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.92rem', fontWeight: 600 }}>Visa ending in 4242</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Expires 12/2028</p>
                  </div>
                  <button className="btn btn-secondary btn-sm">Update</button>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                  <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Payments processed securely via Stripe. PCI DSS Level 1 compliant.
                </p>
              </div>

              {/* Billing Contact */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-md)' }}>Billing Contact</h3>
                <p style={{ fontSize: '0.92rem', marginBottom: '4px' }}>Acme Engineering Corp.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>billing@acme-eng.com</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>Tax ID: US-XXX-XXXX-4242</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Usage Breakdown */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Current <span className="text-gradient">Usage</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Billing cycle: June 1 – June 30, 2026
            </p>
          </div>
          <div className="grid-2">
            {USAGE_ITEMS.map((item) => (
              <div key={item.label} className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-md)' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid color-mix(in srgb, ${item.color} 25%, transparent)`,
                    }}
                  >
                    <item.icon size={20} style={{ color: item.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.label}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      {item.used} / {item.limit}
                    </p>
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: item.color }}>{item.pct}%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${item.pct}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Invoice History */}
      <section className="section-sm">
        <div className="container">
          <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: '1.5rem' }}>
            Invoice <span className="text-gradient">History</span>
          </h2>
          <div
            className="glass-card"
            style={{ padding: 0, overflow: 'hidden', maxWidth: 800 }}
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
                  {['Invoice', 'Date', 'Amount', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '14px 20px',
                        color: 'var(--text-tertiary)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv, i) => (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom:
                        i < INVOICES.length - 1
                          ? '1px solid var(--border-subtle)'
                          : undefined,
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {inv.id}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                      {inv.date}
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                      {inv.amount}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: 'rgba(34, 197, 94, 0.12)',
                          color: inv.statusColor,
                          border: '1px solid rgba(34, 197, 94, 0.2)',
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <Link
                        href="#"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.82rem',
                          color: 'var(--text-accent)',
                          fontWeight: 500,
                        }}
                      >
                        <Download size={14} /> PDF
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Upgrade CTA */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: -150, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="divider-gradient" style={{ marginBottom: 'var(--space-3xl)' }} />
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Need More <span className="text-gradient">Capacity</span>?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 500,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
            }}
          >
            Upgrade to Enterprise for unlimited repositories, dedicated GPU clusters, and custom SLAs.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/contact" className="btn btn-primary btn-lg">
              <Zap size={18} /> Contact Sales
            </Link>
            <Link href="/cloud#pricing" className="btn btn-secondary btn-lg">
              Compare Plans <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
