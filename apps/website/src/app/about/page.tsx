import type { Metadata } from 'next';
import {
  Users,
  Target,
  Lightbulb,
  BookOpen,
  Eye,
  Unlock,
  Heart,
  TrendingUp,
  ArrowRight,
  Mail,
  Briefcase,
  Rocket,
  Flag,
  Award,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Meet the team behind Recurrsive — building the future of engineering intelligence with evidence-based decision making.',
};

const team = [
  {
    name: 'Alex Chen',
    role: 'CEO & Co-founder',
    bio: 'Former VP Engineering at Stripe. 15 years building developer tools and platform infrastructure.',
    icon: Target,
  },
  {
    name: 'Sarah Okafor',
    role: 'CTO & Co-founder',
    bio: 'Ex-Google Brain researcher. PhD in program analysis and knowledge graph systems from MIT.',
    icon: Lightbulb,
  },
  {
    name: 'Marcus Lindgren',
    role: 'VP Engineering',
    bio: 'Led engineering at Datadog for 6 years. Expert in observability systems and distributed architectures.',
    icon: Briefcase,
  },
  {
    name: 'Priya Sharma',
    role: 'Head of Product',
    bio: 'Former product lead at GitHub Copilot. Passionate about developer experience and AI-powered workflows.',
    icon: Rocket,
  },
  {
    name: 'James Whitfield',
    role: 'Head of Design',
    bio: 'Design leader from Figma and Linear. Believes complex systems deserve beautiful, intuitive interfaces.',
    icon: Eye,
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
    title: 'Continuous Learning',
    description:
      'Our AI agents learn from every codebase they analyze. The more they see, the smarter the recommendations become for everyone.',
    icon: TrendingUp,
    color: 'var(--green)',
  },
];

const milestones = [
  {
    date: 'Q1 2025',
    title: 'The Idea',
    description:
      'Founded by Alex and Sarah after seeing the same engineering problems repeated across 50+ organizations.',
    icon: Lightbulb,
  },
  {
    date: 'Q3 2025',
    title: 'First Prototype',
    description:
      'Built the first knowledge graph that could map an entire system — code, infra, AI pipelines, and costs.',
    icon: Zap,
  },
  {
    date: 'Q1 2026',
    title: 'Open Source Launch',
    description:
      'Released the core platform under Apache 2.0 with 14 collectors, 13 analyzers, and multi-agent reasoning.',
    icon: Flag,
  },
  {
    date: 'Q2 2026',
    title: 'Enterprise Ready',
    description:
      'Shipped SSO, RBAC, audit logging, and 40+ dashboard pages. First enterprise customers onboarded.',
    icon: Award,
  },
  {
    date: 'Q3 2026',
    title: 'Growing Fast',
    description:
      'Marketplace, partner portal, and cloud platform launched. Scaling the team and the vision.',
    icon: Rocket,
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

      {/* ── Team ───────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span className="badge badge-accent">
              <Users size={14} /> Leadership
            </span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>
              Meet the <span className="text-gradient">Team</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)', maxWidth: 540, marginInline: 'auto' }}>
              Operators, researchers, and builders who've lived the problems we're solving.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-xl)',
            }}
          >
            {team.map((member) => {
              const Icon = member.icon;
              return (
                <div
                  key={member.name}
                  className="glass-card"
                  style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-xl)' }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--gradient-subtle)',
                      border: '1px solid var(--border-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginInline: 'auto',
                      marginBottom: 'var(--space-lg)',
                    }}
                  >
                    <Icon size={28} style={{ color: 'var(--text-accent)' }} />
                  </div>
                  <h4 style={{ marginBottom: 'var(--space-xs)' }}>{member.name}</h4>
                  <p
                    style={{
                      color: 'var(--text-accent)',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginBottom: 'var(--space-md)',
                    }}
                  >
                    {member.role}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                    {member.bio}
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

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
            <span className="badge badge-accent">
              <Flag size={14} /> Milestones
            </span>
            <h2 style={{ marginTop: 'var(--space-md)' }}>
              Our <span className="text-gradient">Journey</span>
            </h2>
          </div>

          <div style={{ maxWidth: 720, marginInline: 'auto', position: 'relative' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: 27,
                top: 0,
                bottom: 0,
                width: 2,
                background:
                  'linear-gradient(to bottom, var(--purple), var(--blue), var(--cyan), transparent)',
                borderRadius: 1,
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
              {milestones.map((milestone) => {
                const Icon = milestone.icon;
                return (
                  <div key={milestone.date} style={{ display: 'flex', gap: 'var(--space-xl)', position: 'relative' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        minWidth: 56,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}
                    >
                      <Icon size={22} style={{ color: 'var(--text-accent)' }} />
                    </div>
                    <div style={{ paddingTop: 'var(--space-sm)' }}>
                      <span
                        className="text-mono"
                        style={{
                          color: 'var(--text-accent)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                        }}
                      >
                        {milestone.date}
                      </span>
                      <h4 style={{ marginTop: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                        {milestone.title}
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                        {milestone.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Want to <span className="text-gradient">Join Us</span>?
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
            We're building a world-class team of engineers, researchers, and designers who want to
            change how software gets built. Come help us.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contact" className="btn btn-primary btn-lg">
              <Mail size={18} /> Get in Touch
            </a>
            <a
              href="https://github.com/recurrsive"
              className="btn btn-secondary btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowRight size={18} /> View Open Roles
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
