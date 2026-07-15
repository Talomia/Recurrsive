import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Github, History, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'The Recurrsive blog. No posts have been published yet — follow development on GitHub and the changelog.',
};

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
            Engineering Intelligence <span className="text-gradient">Blog</span>
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
            We haven&apos;t published any articles yet. In the meantime, development happens in the
            open — follow along on GitHub and the changelog.
          </p>
        </div>
      </section>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 720 }}>
          <div
            className="glass-card"
            style={{
              textAlign: 'center',
              padding: 'var(--space-3xl)',
              border: '1px dashed var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-sm)',
            }}
          >
            <BookOpen size={44} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No posts yet</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto var(--space-md)', fontSize: '0.92rem', lineHeight: 1.7 }}>
              When we publish technical deep dives and updates, they&apos;ll appear here. For now,
              the changelog and repository are the best places to track progress.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href="/changelog" className="btn btn-primary btn-sm">
                <History size={15} /> View Changelog
              </Link>
              <a
                href="https://github.com/Talomia/Recurrsive"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <Github size={15} /> GitHub <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
