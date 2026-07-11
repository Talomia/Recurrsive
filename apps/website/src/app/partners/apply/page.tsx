'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Handshake,
  Send,
  Check,
  ArrowRight,
  DollarSign,
  Users,
  GraduationCap,
  Megaphone,
  Headphones,
  Rocket,
  Building2,
  Loader2,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: DollarSign,
    title: 'Revenue Sharing',
    description: 'Earn up to 30% revenue share on referred and co-sold deals.',
    color: 'var(--green)',
  },
  {
    icon: GraduationCap,
    title: 'Training & Certification',
    description: 'Free access to certification programs and technical enablement resources.',
    color: 'var(--cyan)',
  },
  {
    icon: Megaphone,
    title: 'Co-Marketing',
    description: 'Joint case studies, webinars, and events to drive pipeline together.',
    color: 'var(--purple)',
  },
  {
    icon: Headphones,
    title: 'Dedicated Support',
    description: 'Priority technical support and a dedicated partner manager for Platinum and Gold tiers.',
    color: 'var(--blue)',
  },
  {
    icon: Rocket,
    title: 'Early Access',
    description: 'Preview new features, APIs, and roadmap items before general availability.',
    color: 'var(--amber)',
  },
  {
    icon: Users,
    title: 'Partner Community',
    description: 'Connect with other partners, share best practices, and collaborate on joint opportunities.',
    color: 'var(--red)',
  },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--bg-glass)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '0.92rem',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  backdropFilter: 'blur(10px)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

export default function PartnerApplyPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

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
            Apply to <span className="text-gradient">Partner Program</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 600,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Join a growing ecosystem of system integrators, consulting firms, and technology partners
            delivering engineering intelligence worldwide.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-sm">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Why <span className="text-gradient">Partner</span> with Us?
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Unlock exclusive benefits to grow your practice and deliver more value to your clients.
            </p>
          </div>
          <div className="grid-3">
            {BENEFITS.map((b) => (
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

      {/* Application Form */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 700 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Submit Your <span className="text-gradient">Application</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
              We&apos;ll review your application and respond within 5 business days.
            </p>
          </div>

          {submitted ? (
            <div
              className="glass-card animate-fade-in"
              style={{
                textAlign: 'center',
                padding: 'var(--space-3xl)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--space-lg)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}
              >
                <Check size={32} style={{ color: 'var(--green)' }} />
              </div>
              <h3 style={{ marginBottom: 'var(--space-sm)' }}>Application Submitted!</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                Thank you for your interest. Our partnerships team will review your application and contact you within 5 business days.
              </p>
              <Link href="/partners" className="btn btn-secondary">
                Back to Partners <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="glass-card" style={{ opacity: submitting ? 0.8 : 1, transition: 'opacity 0.25s' }}>
                <div className="grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div>
                    <label style={labelStyle}>Company Name *</label>
                    <input type="text" required placeholder="Acme Corp" style={inputStyle} disabled={submitting} />
                  </div>
                  <div>
                    <label style={labelStyle}>Website *</label>
                    <input type="url" required placeholder="https://acme.com" style={inputStyle} disabled={submitting} />
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div>
                    <label style={labelStyle}>Contact Name *</label>
                    <input type="text" required placeholder="Jane Smith" style={inputStyle} disabled={submitting} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input type="email" required placeholder="jane@acme.com" style={inputStyle} disabled={submitting} />
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div>
                    <label style={labelStyle}>Company Size *</label>
                    <select required style={{ ...inputStyle, cursor: submitting ? 'not-allowed' : 'pointer' }} disabled={submitting}>
                      <option value="">Select size…</option>
                      <option value="1-10">1–10 employees</option>
                      <option value="11-50">11–50 employees</option>
                      <option value="51-200">51–200 employees</option>
                      <option value="201-1000">201–1,000 employees</option>
                      <option value="1000+">1,000+ employees</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Partnership Type *</label>
                    <select required style={{ ...inputStyle, cursor: submitting ? 'not-allowed' : 'pointer' }} disabled={submitting}>
                      <option value="">Select type…</option>
                      <option value="si">System Integrator</option>
                      <option value="consulting">Consulting Firm</option>
                      <option value="technology">Technology Partner</option>
                      <option value="cloud">Cloud Provider</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 'var(--space-xl)' }}>
                  <label style={labelStyle}>Description of Integration / Use Case *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Tell us how you plan to integrate with or deliver Recurrsive to your clients…"
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                    }}
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-lg"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.75 : 1,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Submitting application...
                    </>
                  ) : (
                    <>
                      <Send size={18} /> Submit Application
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <style>{`
        input::placeholder, textarea::placeholder {
          color: var(--text-tertiary);
        }
        input:focus, textarea:focus, select:focus {
          border-color: var(--border-accent) !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        select option {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
