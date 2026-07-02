'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Recurrsive] Unhandled error:', error);
  }, [error]);

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
        style={{ width: 400, height: 400, top: '5%', left: '10%' }}
      />
      <div
        className="glow-orb glow-blue"
        style={{ width: 350, height: 350, bottom: '10%', right: '5%' }}
      />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div
        className="container animate-fade-in"
        style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
      >
        <div
          className="glass-card"
          style={{
            maxWidth: 540,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            <AlertTriangle size={28} style={{ color: '#f87171' }} />
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 700,
              marginBottom: 'var(--space-sm)',
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
              marginBottom: 'var(--space-md)',
            }}
          >
            An unexpected error occurred. Our team has been notified.
          </p>

          {/* Error details */}
          {error.message && (
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-xl)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-tertiary)',
                wordBreak: 'break-word',
                textAlign: 'left',
              }}
            >
              {error.message}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button onClick={reset} className="btn btn-primary">
              <RotateCcw size={18} />
              Try again
            </button>
            <Link href="/" className="btn btn-secondary">
              <Home size={18} />
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
