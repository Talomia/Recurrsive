'use client';

import {
  Mail,
  Github,
  MessageCircle,
  MapPin,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

const contactCards = [
  {
    icon: Mail,
    title: 'Email Us',
    value: 'hello@recurrsive.dev',
    description: 'For general inquiries and partnerships',
    color: 'var(--purple)',
  },
  {
    icon: Github,
    title: 'GitHub',
    value: 'github.com/Talomia/Recurrsive',
    description: 'Star the repo, open issues, contribute',
    color: 'var(--blue)',
  },
  {
    icon: MessageCircle,
    title: 'Security Reports',
    value: 'security@recurrsive.dev',
    description: 'Private vulnerability disclosure',
    color: 'var(--cyan)',
  },
  {
    icon: MapPin,
    title: 'Deployment',
    value: 'Self-hosted',
    description: 'Your infrastructure and data boundary',
    color: 'var(--green)',
  },
];

const faqs = [
  {
    question: 'How quickly can I get Recurrsive running?',
    answer:
      'Use the production Docker Compose or EasyPanel definitions, configure unique secrets and domains, then complete first-run setup in the dashboard. Deployment time depends on your infrastructure and DNS.',
  },
  {
    question: 'Do you offer enterprise support?',
    answer:
      'Production support and implementation services are available by agreement. The software itself remains Apache-2.0 licensed and self-hosted.',
  },
  {
    question: 'Is my source code safe?',
    answer:
      'Remote repositories are shallow-cloned into temporary storage for analysis and removed when the run finishes. Derived findings, evidence, and project metadata are persisted in your configured database. In self-hosted deployments, those systems remain inside your infrastructure.',
  },
];

const subjectOptions = [
  'General Inquiry',
  'Enterprise Sales',
  'Partnership',
  'Technical Support',
  'Media / Press',
  'Careers',
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      alert('Please fill out all required fields (Name, Email, Message)');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, website: '' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Unable to send your message.');
      setSubmitting(false);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to send your message.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', textAlign: 'center' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 400, height: 400, top: -80, left: '30%', position: 'absolute' }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="badge badge-accent animate-fade-in">
            <Mail size={14} /> Contact
          </span>
          <h1
            className="animate-fade-in-up stagger-1"
            style={{ marginTop: 'var(--space-lg)', maxWidth: 600, marginInline: 'auto' }}
          >
            Get in <span className="text-gradient">Touch</span>
          </h1>
          <p
            className="animate-fade-in-up stagger-2"
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.15rem',
              maxWidth: 520,
              marginInline: 'auto',
              marginTop: 'var(--space-lg)',
            }}
          >
            Whether you're evaluating Recurrsive for your team or want to partner with us, we'd
            love to hear from you.
          </p>
        </div>
      </section>

      {/* ── Form + Contact Info ────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Left — Contact Form or Success Card */}
            {submitted ? (
              <div
                className="glass-card animate-fade-in"
                style={{
                  padding: 'var(--space-3xl) var(--space-2xl)',
                  textAlign: 'center',
                  background: 'rgba(20, 15, 35, 0.4)',
                  border: '1px solid var(--border-accent)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 8px 32px 0 rgba(124, 58, 237, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid var(--green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 'var(--space-md)',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--green)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Message Received!
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.95rem',
                    maxWidth: 360,
                    margin: '0 auto var(--space-lg)',
                    lineHeight: 1.6,
                  }}
                >
                  Thank you for reaching out, <strong>{formData.name}</strong>. Our engineering
                  team has securely received your message.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', email: '', company: '', subject: '', message: '' });
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '10px 24px' }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 'var(--space-2xl)' }}>
                <h3 style={{ marginBottom: 'var(--space-lg)' }}>Send a Message</h3>
                <form
                  onSubmit={handleSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
                >
                  {submitError && (
                    <div role="alert" style={{ color: 'var(--red)', fontSize: '0.88rem' }}>
                      {submitError}
                    </div>
                  )}
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="name"
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        marginBottom: 'var(--space-xs)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Name <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      placeholder="Your name"
                      style={inputStyle}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        marginBottom: 'var(--space-xs)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Email <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      style={inputStyle}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  {/* Company */}
                  <div>
                    <label
                      htmlFor="company"
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        marginBottom: 'var(--space-xs)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Company
                    </label>
                    <input
                      id="company"
                      type="text"
                      placeholder="Your company"
                      style={inputStyle}
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      htmlFor="subject"
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        marginBottom: 'var(--space-xs)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Subject
                    </label>
                    <select
                      id="subject"
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    >
                      <option value="" disabled>
                        Select a subject…
                      </option>
                      {subjectOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="message"
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        marginBottom: 'var(--space-xs)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Message <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      required
                      placeholder="Tell us about your project…"
                      style={{ ...inputStyle, resize: 'vertical' }}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary btn-lg"
                    style={{
                      marginTop: 'var(--space-sm)',
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      opacity: submitting ? 0.8 : 1,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? (
                      <>
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            borderTopColor: '#ffffff',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'spin 0.8s linear infinite',
                          }}
                        />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={18} /> Send Message
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Right — Contact Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              {contactCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="glass-card"
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        minWidth: 52,
                        borderRadius: 'var(--radius-md)',
                        background: `${card.color}15`,
                        border: `1px solid ${card.color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={22} style={{ color: card.color }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', marginBottom: 2 }}>{card.title}</h4>
                      <p
                        style={{
                          color: 'var(--text-accent)',
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        {card.value}
                      </p>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                        {card.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 740 }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
            <span className="badge badge-accent">
              <HelpCircle size={14} /> FAQ
            </span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>
              Common <span className="text-gradient">Questions</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="glass-card"
                style={{ cursor: 'pointer', padding: 'var(--space-lg) var(--space-xl)' }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                  }}
                >
                  <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{faq.question}</h4>
                  {openFaq === i ? (
                    <ChevronUp size={20} style={{ color: 'var(--text-tertiary)', minWidth: 20 }} />
                  ) : (
                    <ChevronDown size={20} style={{ color: 'var(--text-tertiary)', minWidth: 20 }} />
                  )}
                </div>
                {openFaq === i && (
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.95rem',
                      lineHeight: 1.7,
                      marginTop: 'var(--space-md)',
                    }}
                  >
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(16, 185, 129, 0.2); }
          50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(16, 185, 129, 0.4); }
        }
      `}</style>
    </div>
  );
}

/* ── Shared input style ────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid var(--border-medium)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border-color 0.2s ease',
};
