'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Crown,
  Award,
  Medal,
  Building2,
  Globe,
  ChevronRight,
  MapPin,
  Handshake,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

type Tier = 'All' | 'Platinum' | 'Gold' | 'Silver';

const TIERS: { value: Tier; label: string; color: string }[] = [
  { value: 'All', label: 'All Partners', color: 'var(--text-secondary)' },
  { value: 'Platinum', label: 'Platinum', color: '#c084fc' },
  { value: 'Gold', label: 'Gold', color: 'var(--amber)' },
  { value: 'Silver', label: 'Silver', color: 'var(--text-secondary)' },
];

interface Partner {
  name: string;
  tier: 'Platinum' | 'Gold' | 'Silver';
  tierColor: string;
  specialization: string;
  regions: string[];
  description: string;
  icon: React.ElementType;
}

const PARTNERS: Partner[] = [
  {
    name: 'CloudForge Consulting',
    tier: 'Platinum',
    tierColor: '#c084fc',
    specialization: 'Enterprise Cloud Migration',
    regions: ['North America', 'Europe'],
    description:
      'Fortune 500 cloud migration specialists. 47+ Recurrsive implementations across financial services, healthcare, and government sectors.',
    icon: Building2,
  },
  {
    name: 'AI Safety Labs',
    tier: 'Platinum',
    tierColor: '#c084fc',
    specialization: 'AI Governance & Compliance',
    regions: ['North America', 'Asia Pacific'],
    description:
      'AI governance platform builder. Develops compliance extensions for regulated industries including HIPAA, SOX, and FDA 21 CFR Part 11.',
    icon: Building2,
  },
  {
    name: 'DevOps Pro Solutions',
    tier: 'Gold',
    tierColor: 'var(--amber)',
    specialization: 'DevOps Transformation',
    regions: ['North America'],
    description:
      'DevOps consultancy specializing in CI/CD optimization, platform engineering, and DORA metrics improvement using engineering intelligence.',
    icon: Building2,
  },
  {
    name: 'FinTech Assurance Group',
    tier: 'Gold',
    tierColor: 'var(--amber)',
    specialization: 'Financial Services',
    regions: ['North America', 'Europe'],
    description:
      'Regulatory compliance consultancy for banks, fintechs, and insurance companies. Expertise in SOX, PCI-DSS, and risk modeling.',
    icon: Building2,
  },
  {
    name: 'Nordic Engineering Partners',
    tier: 'Gold',
    tierColor: 'var(--amber)',
    specialization: 'Automotive & Manufacturing',
    regions: ['Europe', 'Middle East'],
    description:
      'Engineering intelligence for automotive OEMs and industrial manufacturers. Embedded systems analysis and supply chain risk assessment.',
    icon: Building2,
  },
  {
    name: 'Platform Engineering Co',
    tier: 'Silver',
    tierColor: 'var(--text-secondary)',
    specialization: 'Developer Experience',
    regions: ['North America'],
    description:
      'Internal developer platform builders. Integrating Recurrsive into golden paths, service catalogs, and self-service developer portals.',
    icon: Building2,
  },
  {
    name: 'Asia Digital Consulting',
    tier: 'Silver',
    tierColor: 'var(--text-secondary)',
    specialization: 'Digital Transformation',
    regions: ['Asia Pacific'],
    description:
      'APAC-focused digital transformation firm. Helps enterprises across Singapore, Japan, and Australia adopt engineering intelligence practices.',
    icon: Building2,
  },
  {
    name: 'SecureStack Advisory',
    tier: 'Platinum',
    tierColor: '#c084fc',
    specialization: 'Security & Compliance',
    regions: ['North America', 'Europe', 'Asia Pacific'],
    description:
      'Cybersecurity consultancy with deep Recurrsive expertise. Specializes in supply chain security, SBOM analysis, and zero-trust architecture assessments.',
    icon: Building2,
  },
];

export default function PartnerDirectoryPage() {
  const [activeTier, setActiveTier] = useState<Tier>('All');

  const filtered =
    activeTier === 'All'
      ? PARTNERS
      : PARTNERS.filter((p) => p.tier === activeTier);

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
        <div
          className="glow-orb glow-blue"
          style={{ width: 400, height: 400, bottom: -100, left: -100 }}
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
              maxWidth: 600,
              margin: '0 auto var(--space-xl)',
              lineHeight: 1.7,
            }}
          >
            Find a certified Recurrsive partner to help you implement, optimize,
            and scale engineering intelligence in your organization.
          </p>

          {/* Search */}
          <div
            style={{
              maxWidth: 520,
              margin: '0 auto var(--space-xl)',
              position: 'relative',
            }}
          >
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search partners by name, specialization, or region…"
              style={{
                width: '100%',
                padding: '14px 20px 14px 44px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                backdropFilter: 'blur(10px)',
              }}
            />
          </div>

          {/* Tier Filter */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              flexWrap: 'wrap',
            }}
          >
            {TIERS.map((tier) => (
              <button
                key={tier.value}
                onClick={() => setActiveTier(tier.value)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor:
                    activeTier === tier.value
                      ? 'var(--border-accent)'
                      : 'var(--border-subtle)',
                  background:
                    activeTier === tier.value
                      ? 'rgba(124, 58, 237, 0.15)'
                      : 'var(--bg-glass)',
                  color:
                    activeTier === tier.value
                      ? 'var(--text-accent)'
                      : 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition-fast)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Cards */}
      <section className="section-sm">
        <div className="container">
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.88rem', marginBottom: 'var(--space-lg)' }}>
            Showing {filtered.length} partner{filtered.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {filtered.map((p) => (
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
                {/* Logo Placeholder */}
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
                      {p.tier === 'Platinum' && <Crown size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                      {p.tier === 'Gold' && <Award size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                      {p.tier === 'Silver' && <Medal size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                      {p.tier}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                    {p.specialization} ·{' '}
                    <MapPin size={12} style={{ verticalAlign: 'middle' }} />{' '}
                    {p.regions.join(', ')}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
                    {p.description}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    {p.regions.map((r) => (
                      <span
                        key={r}
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
                        <Globe size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contact Button */}
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

      {/* CTA */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: -150, right: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="divider-gradient" style={{ marginBottom: 'var(--space-3xl)' }} />
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Become a <span className="text-gradient">Partner</span>
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
            Join our ecosystem and help organizations unlock engineering intelligence. We review applications within 5 business days.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/partners/apply" className="btn btn-primary btn-lg">
              <Sparkles size={18} /> Apply to Partner
            </Link>
            <Link href="/partners" className="btn btn-secondary btn-lg">
              Program Details <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        input::placeholder {
          color: var(--text-tertiary);
        }
        input:focus {
          border-color: var(--border-accent) !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
      `}</style>
    </div>
  );
}
