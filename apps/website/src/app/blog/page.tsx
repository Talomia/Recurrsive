import type { Metadata } from 'next';
import {
  BookOpen,
  Calendar,
  User,
  ArrowRight,
  Cpu,
  Package,
  GitBranch,
  Brain,
  Layers,
  FileText,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Insights on engineering intelligence, AI-powered analysis, architecture, and building better software systems.',
};

const categories: Record<string, { color: string; bg: string; border: string }> = {
  Engineering: {
    color: 'var(--purple)',
    bg: 'rgba(124, 58, 237, 0.12)',
    border: 'rgba(124, 58, 237, 0.25)',
  },
  Product: {
    color: 'var(--blue)',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.25)',
  },
  'Open Source': {
    color: 'var(--green)',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.25)',
  },
  'AI/ML': {
    color: 'var(--cyan)',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.25)',
  },
  Architecture: {
    color: 'var(--amber)',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  'Case Study': {
    color: '#f472b6',
    bg: 'rgba(244, 114, 182, 0.12)',
    border: 'rgba(244, 114, 182, 0.25)',
  },
};

const posts = [
  {
    title: 'Why Engineering Intelligence is the Next Platform Category',
    excerpt:
      'Observability told you what happened. Engineering intelligence tells you what to do about it — and why it matters to the business.',
    date: 'June 28, 2026',
    author: 'Alex Chen',
    category: 'Engineering',
    icon: Layers,
    readTime: '8 min read',
  },
  {
    title: 'Building a Knowledge Graph of Your Entire System',
    excerpt:
      'How we model code, infrastructure, AI pipelines, team structures, and costs into a single queryable graph that surfaces hidden relationships.',
    date: 'June 22, 2026',
    author: 'Sarah Okafor',
    category: 'Architecture',
    icon: GitBranch,
    readTime: '12 min read',
  },
  {
    title: 'Multi-Agent Reasoning: How AI Specialists Debate',
    excerpt:
      'Inside our multi-agent architecture where specialist AI agents analyze evidence, form recommendations, and debate trade-offs before presenting a consensus.',
    date: 'June 15, 2026',
    author: 'Sarah Okafor',
    category: 'AI/ML',
    icon: Brain,
    readTime: '10 min read',
  },
  {
    title: 'From Static Analysis to Evidence-Based Recommendations',
    excerpt:
      'Static analysis finds bugs. Evidence-based analysis finds strategic opportunities. Here\'s how we made the leap from linting to leadership-grade insights.',
    date: 'June 8, 2026',
    author: 'Marcus Lindgren',
    category: 'Product',
    icon: Cpu,
    readTime: '7 min read',
  },
  {
    title: 'Open-Sourcing Recurrsive: Our Apache 2.0 Journey',
    excerpt:
      'Why we chose Apache 2.0, what we learned from building in the open, and how community contributions shaped our architecture.',
    date: 'June 1, 2026',
    author: 'Alex Chen',
    category: 'Open Source',
    icon: Package,
    readTime: '6 min read',
  },
  {
    title: 'Understanding Your AI Pipeline End-to-End',
    excerpt:
      'Most teams can\'t answer basic questions about their AI systems. Recurrsive maps models, training data, inference costs, and drift into one view.',
    date: 'May 25, 2026',
    author: 'Priya Sharma',
    category: 'Case Study',
    icon: FileText,
    readTime: '9 min read',
  },
];

export default function BlogPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', textAlign: 'center' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 450, height: 450, top: -120, right: '25%', position: 'absolute' }}
        />
        <div
          className="glow-orb glow-cyan"
          style={{ width: 350, height: 350, bottom: -100, left: '10%', position: 'absolute' }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="badge badge-accent animate-fade-in">
            <BookOpen size={14} /> Blog
          </span>
          <h1
            className="animate-fade-in-up stagger-1"
            style={{ marginTop: 'var(--space-lg)', maxWidth: 700, marginInline: 'auto' }}
          >
            Engineering Intelligence{' '}
            <span className="text-gradient">Blog</span>
          </h1>
          <p
            className="animate-fade-in-up stagger-2"
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.15rem',
              maxWidth: 580,
              marginInline: 'auto',
              marginTop: 'var(--space-lg)',
            }}
          >
            Deep dives into AI-powered analysis, architecture patterns, open source, and building
            software systems that scale.
          </p>
        </div>
      </section>

      {/* ── Posts Grid ─────────────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container">
          <div className="grid-3">
            {posts.map((post) => {
              const catStyle = categories[post.category];
              const PostIcon = post.icon;
              return (
                <article
                  key={post.title}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-md)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Icon header */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--radius-md)',
                      background: catStyle.bg,
                      border: `1px solid ${catStyle.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PostIcon size={22} style={{ color: catStyle.color }} />
                  </div>

                  {/* Category */}
                  <span
                    className="badge"
                    style={{
                      background: catStyle.bg,
                      color: catStyle.color,
                      border: `1px solid ${catStyle.border}`,
                      alignSelf: 'flex-start',
                      fontSize: '0.75rem',
                    }}
                  >
                    {post.category}
                  </span>

                  {/* Title */}
                  <h3 style={{ fontSize: '1.15rem', lineHeight: 1.35 }}>{post.title}</h3>

                  {/* Excerpt */}
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.92rem',
                      lineHeight: 1.65,
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {post.excerpt}
                  </p>

                  {/* Meta footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 'var(--space-md)',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                      color: 'var(--text-tertiary)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-sm)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <User size={13} /> {post.author}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} /> {post.date}
                    </span>
                  </div>

                  {/* Read more */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--text-accent)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    Read article <ArrowRight size={15} />
                  </span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Newsletter CTA ────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Stay <span className="text-gradient">Up to Date</span>
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.05rem',
              maxWidth: 480,
              marginInline: 'auto',
              marginBottom: 'var(--space-xl)',
            }}
          >
            Get engineering intelligence insights delivered to your inbox. No spam, just signal.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              justifyContent: 'center',
              maxWidth: 460,
              marginInline: 'auto',
              flexWrap: 'wrap',
            }}
          >
            <input
              type="email"
              placeholder="you@company.com"
              style={{
                flex: 1,
                minWidth: 220,
                padding: '12px 18px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            <button className="btn btn-primary">Subscribe</button>
          </div>
        </div>
      </section>
    </div>
  );
}
