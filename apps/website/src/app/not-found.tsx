import Link from 'next/link';
import { Home, BookOpen } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        paddingTop: 'var(--nav-height)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Glow orbs ─────────────────────────────────────────────────────── */}
      <div
        className="glow-orb glow-purple"
        style={{ width: 500, height: 500, top: '-10%', left: '-5%' }}
      />
      <div
        className="glow-orb glow-blue"
        style={{ width: 400, height: 400, bottom: '-10%', right: '-5%' }}
      />
      <div
        className="glow-orb glow-cyan"
        style={{ width: 300, height: 300, top: '40%', right: '20%' }}
      />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div
        className="container animate-fade-in"
        style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
      >
        {/* 404 number */}
        <h1
          className="text-gradient"
          style={{
            fontSize: 'clamp(6rem, 15vw, 12rem)',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            marginBottom: 'var(--space-lg)',
          }}
        >
          404
        </h1>

        {/* Glass card */}
        <div
          className="glass-card"
          style={{
            maxWidth: 520,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
              fontWeight: 700,
              marginBottom: 'var(--space-md)',
            }}
          >
            Page not found
          </h2>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
              marginBottom: 'var(--space-xl)',
            }}
          >
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Check the URL or head back to familiar territory.
          </p>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/" className="btn btn-primary">
              <Home size={18} />
              Go Home
            </Link>
            <Link href="/docs" className="btn btn-secondary">
              <BookOpen size={18} />
              View Docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
