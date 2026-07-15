'use client';

import {
  Mail,
  Github,
  MessageCircle,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

const GITHUB_URL = 'https://github.com/Talomia/Recurrsive';
const DISCUSSIONS_URL = 'https://github.com/Talomia/Recurrsive/discussions';
const ISSUES_URL = 'https://github.com/Talomia/Recurrsive/issues';
const EMAIL = 'hello@recurrsive.dev';

const contactCards = [
  {
    icon: Github,
    title: 'GitHub',
    value: 'github.com/Talomia/Recurrsive',
    description: 'Star the repo, open issues, and contribute',
    href: GITHUB_URL,
    color: 'var(--blue)',
  },
  {
    icon: MessageCircle,
    title: 'GitHub Discussions',
    value: 'Ask & discuss',
    description: 'Questions, ideas, and community help',
    href: DISCUSSIONS_URL,
    color: 'var(--cyan)',
  },
  {
    icon: Mail,
    title: 'Email',
    value: EMAIL,
    description: 'For anything that doesn’t fit a public issue',
    href: `mailto:${EMAIL}`,
    color: 'var(--purple)',
  },
];

const faqs = [
  {
    question: 'How quickly can I get Recurrsive running?',
    answer:
      'The open-source platform can be self-hosted with Docker Compose in a few minutes: clone the repo, run docker compose up -d, and open the dashboard. See the Getting Started and Deployment guides for details.',
  },
  {
    question: 'Is there paid support?',
    answer:
      'Yes — optional Enterprise Support provides deployment help, configuration guidance, and prioritized fixes for the same open-source software. It does not unlock extra features. Reach out to discuss scope.',
  },
  {
    question: 'Is my source code safe?',
    answer:
      'Recurrsive is self-hosted, so your code and analysis data stay on infrastructure you control. Collectors extract structural and metadata signals; nothing is sent to a third-party service.',
  },
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
  });

  // Honest behaviour: there is no server-side contact endpoint, so we do not
  // pretend to receive the message. Instead we compose a mailto: link and hand
  // off to the visitor's email client.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      alert('Please fill out all required fields (Name, Email, Message)');
      return;
    }
    const subject = encodeURIComponent(
      formData.subject ? `[Recurrsive] ${formData.subject}` : '[Recurrsive] Contact',
    );
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}` +
        (formData.company ? `\nCompany: ${formData.company}` : '') +
        `\n\n${formData.message}`,
    );
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
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
              maxWidth: 540,
              marginInline: 'auto',
              marginTop: 'var(--space-lg)',
            }}
          >
            The fastest way to reach the project is on GitHub. You can also send an email — the form
            below opens your email client with the details prefilled.
          </p>
        </div>
      </section>

      {/* ── Form + Contact Info ────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Left — Contact Form */}
            <div className="glass-card" style={{ padding: 'var(--space-2xl)' }}>
              <h3 style={{ marginBottom: 'var(--space-sm)' }}>Send a Message</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                This opens your email client addressed to {EMAIL}. Prefer public? Use{' '}
                <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>
                  GitHub Issues
                </a>
                .
              </p>
              <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
              >
                <div>
                  <label htmlFor="name" style={labelStyle}>
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

                <div>
                  <label htmlFor="email" style={labelStyle}>
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

                <div>
                  <label htmlFor="company" style={labelStyle}>
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

                <div>
                  <label htmlFor="subject" style={labelStyle}>
                    Subject
                  </label>
                  <select
                    id="subject"
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  >
                    <option value="">Select a subject…</option>
                    {['General Inquiry', 'Enterprise Support', 'Partnership', 'Technical Question', 'Media / Press'].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="message" style={labelStyle}>
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
                  className="btn btn-primary btn-lg"
                  style={{
                    marginTop: 'var(--space-sm)',
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Send size={18} /> Compose Email
                </button>
              </form>
            </div>

            {/* Right — Contact Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              {contactCards.map((card) => {
                const Icon = card.icon;
                return (
                  <a
                    key={card.title}
                    href={card.href}
                    target={card.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel={card.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                    className="glass-card"
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', textDecoration: 'none' }}
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
                  </a>
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.88rem',
  fontWeight: 600,
  marginBottom: 'var(--space-xs)',
  color: 'var(--text-secondary)',
};
