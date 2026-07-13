import type { ReactNode } from 'react';

export function LegalDocument({
  label,
  title,
  updated,
  children,
}: {
  label: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main style={{ paddingTop: 'var(--nav-height)' }}>
      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-md)' }}>{label}</div>
          <h1 style={{ marginBottom: 'var(--space-sm)' }}>{title}</h1>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2xl)' }}>Last updated: {updated}</p>
          <div className="glass-card legal-document" style={{ display: 'grid', gap: 'var(--space-xl)', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)' }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
