'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Send,
  Check,
  ArrowRight,
  FileCode2,
  Shield,
  Clock,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Sparkles,
} from 'lucide-react';

const GUIDELINES = [
  {
    icon: FileCode2,
    title: 'Open Source Required',
    description: 'Extensions must be published in a public repository with a compatible open-source license (MIT, Apache 2.0, etc.).',
    color: 'var(--blue)',
  },
  {
    icon: Shield,
    title: 'Security Review',
    description: 'All submissions undergo automated security scanning and manual code review before listing in the marketplace.',
    color: 'var(--purple)',
  },
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Include a comprehensive README with installation instructions, configuration options, and usage examples.',
    color: 'var(--cyan)',
  },
  {
    icon: Clock,
    title: 'Review Timeline',
    description: 'Reviews typically complete within 5–7 business days. You&apos;ll receive feedback if changes are needed.',
    color: 'var(--amber)',
  },
];

const CHECKLIST = [
  'Extension follows the Plugin SDK conventions',
  'README includes installation and usage instructions',
  'All dependencies are explicitly declared',
  'No hardcoded credentials or secrets',
  'Test suite with > 80% coverage',
  'Semantic versioning (semver) applied',
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

export default function MarketplaceSubmitPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
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
          style={{ width: 500, height: 500, top: -200, left: '50%', transform: 'translateX(-50%)' }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Package size={14} /> Marketplace
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            Submit an <span className="text-gradient">Extension</span>
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
            Share your analyzers, collectors, policies, and intelligence packs with
            the Recurrsive community.
          </p>
        </div>
      </section>

      {/* Guidelines */}
      <section className="section-sm">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>
              Submission <span className="text-gradient">Guidelines</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', fontSize: '1.05rem' }}>
              Please review the following requirements before submitting your extension.
            </p>
          </div>
          <div className="grid-4">
            {GUIDELINES.map((g) => (
              <div key={g.title} className="glass-card" style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-md)',
                    background: `color-mix(in srgb, ${g.color} 15%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-md)',
                    border: `1px solid color-mix(in srgb, ${g.color} 25%, transparent)`,
                  }}
                >
                  <g.icon size={24} style={{ color: g.color }} />
                </div>
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>{g.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  {g.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checklist + Form */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Checklist Sidebar */}
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-lg)' }}>
                Pre-Submission Checklist
              </h3>
              <div className="glass-card">
                <ul style={{ listStyle: 'none' }}>
                  {CHECKLIST.map((item) => (
                    <li
                      key={item}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 0',
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="glass-card"
                style={{
                  marginTop: 'var(--space-lg)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
              >
                <AlertTriangle size={20} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '4px' }}>
                    Need help?
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Check the{' '}
                    <Link href="/docs" style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>
                      Plugin SDK docs
                    </Link>{' '}
                    or join our{' '}
                    <Link href="#" style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>
                      community Slack
                    </Link>{' '}
                    for guidance.
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-lg)' }}>
                Extension Details
              </h3>

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
                  <h3 style={{ marginBottom: 'var(--space-sm)' }}>Extension Submitted!</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Your extension has been queued for review. We&apos;ll notify you within 5–7 business days.
                  </p>
                  <Link href="/marketplace" className="btn btn-secondary">
                    Back to Marketplace <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="glass-card">
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                      <label style={labelStyle}>Extension Name *</label>
                      <input type="text" required placeholder="My Awesome Analyzer" style={inputStyle} />
                    </div>

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                      <label style={labelStyle}>Category *</label>
                      <select required style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">Select category…</option>
                        <option value="analyzer">Analyzer</option>
                        <option value="collector">Collector</option>
                        <option value="policy">Policy</option>
                        <option value="intelligence-pack">Intelligence Pack</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                      <label style={labelStyle}>Description *</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Describe what your extension does, what problems it solves, and key features…"
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                      <label style={labelStyle}>Repository URL *</label>
                      <input
                        type="url"
                        required
                        placeholder="https://github.com/your-org/your-extension"
                        style={inputStyle}
                      />
                    </div>

                    <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
                      <div>
                        <label style={labelStyle}>Author *</label>
                        <input type="text" required placeholder="Your Name or Org" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Version *</label>
                        <input type="text" required placeholder="1.0.0" style={inputStyle} />
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                      <Send size={18} /> Submit Extension
                    </button>
                  </div>
                </form>
              )}
            </div>
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
            Explore the <span className="text-gradient">Marketplace</span>
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
            Browse existing extensions for inspiration, or dive into the Plugin SDK to start building.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/marketplace" className="btn btn-primary btn-lg">
              <Sparkles size={18} /> Browse Extensions
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              Plugin SDK Docs <ArrowRight size={18} />
            </Link>
          </div>
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
