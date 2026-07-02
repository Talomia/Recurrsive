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
    value: 'hello@recurrsive.com',
    description: 'For general inquiries and partnerships',
    color: 'var(--purple)',
  },
  {
    icon: Github,
    title: 'GitHub',
    value: 'github.com/recurrsive',
    description: 'Star the repo, open issues, contribute',
    color: 'var(--blue)',
  },
  {
    icon: MessageCircle,
    title: 'Discord Community',
    value: 'discord.gg/recurrsive',
    description: 'Chat with the team and community',
    color: 'var(--cyan)',
  },
  {
    icon: MapPin,
    title: 'Office',
    value: 'San Francisco, CA',
    description: 'Remote-first, HQ for meetups',
    color: 'var(--green)',
  },
];

const faqs = [
  {
    question: 'How quickly can I get Recurrsive running?',
    answer:
      'The open-source version can be deployed in under 15 minutes with Docker Compose. Our cloud platform requires zero setup — just connect your repositories and you\'ll have your first analysis within the hour.',
  },
  {
    question: 'Do you offer enterprise support?',
    answer:
      'Yes. Enterprise plans include dedicated support, SLA guarantees, SSO/SAML integration, custom collectors, on-premise deployment options, and a dedicated customer success manager.',
  },
  {
    question: 'Is my source code safe?',
    answer:
      'Absolutely. Recurrsive never stores your raw source code. Our collectors extract metadata and structural information only. For on-premise deployments, all data stays within your infrastructure.',
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
            {/* Left — Contact Form */}
            <div className="glass-card" style={{ padding: 'var(--space-2xl)' }}>
              <h3 style={{ marginBottom: 'var(--space-lg)' }}>Send a Message</h3>
              <form
                onSubmit={(e) => e.preventDefault()}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
              >
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
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    style={inputStyle}
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
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    style={inputStyle}
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
                  <select id="subject" style={{ ...inputStyle, cursor: 'pointer' }}>
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
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    placeholder="Tell us about your project…"
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: 'var(--space-sm)', alignSelf: 'flex-start' }}
                >
                  <Send size={18} /> Send Message
                </button>
              </form>
            </div>

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
