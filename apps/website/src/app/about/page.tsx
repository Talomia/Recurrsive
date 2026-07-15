import type { Metadata } from 'next';
import {
  Users,
  BookOpen,
  Unlock,
  Heart,
  TrendingUp,
  ArrowRight,
  Github,
  GitPullRequest,
  MessageSquare,
  Scale,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Recurrsive is an open-source Engineering Intelligence Platform — evidence-based recommendations across code, architecture, AI, infrastructure, and cost.',
};

const contributing = [
  {
    title: 'Read the Code',
    description:
      'Every collector, analyzer, and reasoning agent is open under Apache 2.0. Inspect exactly how a recommendation is produced — no black boxes.',
    icon: BookOpen,
    color: 'var(--purple)',
  },
  {
    title: 'Open an Issue',
    description:
      'Found a bug, a false positive, or a missing analysis rule? File an issue on GitHub. Bug reports and feature requests shape the roadmap.',
    icon: MessageSquare,
    color: 'var(--blue)',
  },
  {
    title: 'Send a Pull Request',
    description:
      'Add a collector, write an analyzer rule, or build a plugin with the SDK. Contributions of any size are welcome.',
    icon: GitPullRequest,
    color: 'var(--cyan)',
  },
  {
    title: 'Apache 2.0 Licensed',
    description:
      'Permissively licensed and free to self-host. Use it commercially, fork it, and extend it without vendor lock-in.',
    icon: Scale,
    color: 'var(--green)',
  },
];

const values = [
  {
    title: 'Evidence Over Opinions',
    description:
      'Every recommendation we make is backed by data collected from your actual systems — not guesswork, not best practices from blog posts.',
    icon: BookOpen,
    color: 'var(--purple)',
  },
  {
    title: 'Open by Default',
    description:
      'Our core platform is Apache 2.0. We believe engineering intelligence should be accessible to every team, not locked behind enterprise gates.',
    icon: Unlock,
    color: 'var(--blue)',
  },
  {
    title: 'Engineers First',
    description:
      'We build for the people in the trenches — the engineers making thousands of decisions every day. Tools should empower, not surveil.',
    icon: Heart,
    color: 'var(--cyan)',
  },
  {
    title: 'Continuous Improvement',
    description:
      'Analyzers and reasoning agents evolve release by release. Every new rule and collector added to the open-source project benefits everyone who self-hosts it.',
    icon: TrendingUp,
    color: 'var(--green)',
  },
];

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', textAlign: 'center' }}
      >
        {/* Decorative orbs */}
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -100, left: '20%', position: 'absolute' }}
        />
        <div
          className="glow-orb glow-blue"
          style={{ width: 400, height: 400, bottom: -80, right: '15%', position: 'absolute' }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="badge badge-accent animate-fade-in">
            <Users size={14} /> Our Story
          </span>
          <h1
            className="animate-fade-in-up stagger-1"
            style={{ marginTop: 'var(--space-lg)', maxWidth: 800, marginInline: 'auto' }}
          >
            Building the Future of{' '}
            <span className="text-gradient">Engineering Intelligence</span>
          </h1>
          <p
            className="animate-fade-in-up stagger-2"
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.2rem',
              maxWidth: 640,
              marginInline: 'auto',
              marginTop: 'var(--space-lg)',
            }}
          >
            We started Recurrsive because we believe the most impactful engineering decisions
            should be based on evidence — not instinct, not politics, not whoever talks the loudest in the room.
          </p>
        </div>
      </section>

      {/* ── Mission ────────────────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container">
          <div
            className="glass-card"
            style={{
              padding: 'var(--space-3xl)',
              textAlign: 'center',
              maxWidth: 900,
              marginInline: 'auto',
              background: 'var(--gradient-subtle)',
              borderColor: 'var(--border-accent)',
            }}
          >
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>
              Our <span className="text-gradient">Mission</span>
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1.15rem',
                lineHeight: 1.8,
                maxWidth: 720,
                marginInline: 'auto',
              }}
            >
              Software systems are the most complex artifacts humans build. Yet the decisions that
              shape them — what to refactor, where to invest, when to migrate — are still made with
              shockingly little data. Recurrsive gives engineering leaders a complete, evidence-based
              picture of their system so every decision moves the needle on what matters most:
              shipping great products, faster and safer.
            </p>
          </div>
        </div>
      </section>

      {/* ── Open Source Project ────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span className="badge badge-accent">
              <Github size={14} /> Open Source
            </span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>
              An <span className="text-gradient">Open-Source</span> Project
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)', maxWidth: 620, marginInline: 'auto' }}>
              Recurrsive is developed in the open under the Apache 2.0 license. There is no
              proprietary core and no paywall on the platform itself — anyone can read the code,
              run it, and contribute.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--space-xl)',
            }}
          >
            {contributing.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="glass-card"
                  style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-xl)' }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 'var(--radius-md)',
                      background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${item.color} 25%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginInline: 'auto',
                      marginBottom: 'var(--space-lg)',
                    }}
                  >
                    <Icon size={24} style={{ color: item.color }} />
                  </div>
                  <h4 style={{ marginBottom: 'var(--space-sm)' }}>{item.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Values ─────────────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span className="badge badge-accent">
              <Heart size={14} /> What We Believe
            </span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>
              Our <span className="text-gradient">Values</span>
            </h2>
          </div>

          <div className="grid-2">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div key={value.title} className="glass-card" style={{ display: 'flex', gap: 'var(--space-lg)' }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      minWidth: 52,
                      borderRadius: 'var(--radius-md)',
                      background: `${value.color}15`,
                      border: `1px solid ${value.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={24} style={{ color: value.color }} />
                  </div>
                  <div>
                    <h4 style={{ marginBottom: 'var(--space-sm)' }}>{value.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                      {value.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Get <span className="text-gradient">Involved</span>
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.1rem',
              maxWidth: 560,
              marginInline: 'auto',
              marginBottom: 'var(--space-xl)',
            }}
          >
            Recurrsive is built in the open. Star the repository, try it on your own codebase, open
            an issue, or send a pull request — contributions of every kind are welcome.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/Talomia/Recurrsive"
              className="btn btn-primary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={18} /> View on GitHub
            </a>
            <a href="/docs/getting-started" className="btn btn-secondary btn-lg">
              <ArrowRight size={18} /> Get Started
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
