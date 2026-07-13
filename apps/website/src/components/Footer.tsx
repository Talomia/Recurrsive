import Link from 'next/link';
import { Github, Mail, Heart } from 'lucide-react';

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '/product' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Deploy', href: '/cloud' },
    { label: 'Changelog', href: '/changelog' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'Getting Started', href: '/docs/getting-started' },
    { label: 'API Reference', href: '/docs/api-reference' },
    { label: 'CLI Reference', href: '/docs/cli-reference' },
    { label: 'Deployment', href: '/docs/deployment' },
    { label: 'Architecture', href: '/docs/architecture' },
    { label: 'Blog', href: '/blog' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '/about' },
    { label: 'Apache 2.0 License', href: 'https://github.com/Talomia/Recurrsive/blob/main/LICENSE' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
};

const SOCIAL_LINKS = [
  { icon: Github, href: 'https://github.com/Talomia/Recurrsive', label: 'GitHub' },
  { icon: Mail, href: 'mailto:hello@recurrsive.dev', label: 'Email' },
];

export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
      }}
    >
      <div className="container" style={{ padding: 'var(--space-4xl) var(--space-lg) var(--space-2xl)' }}>
        {/* Links Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-2xl)',
            marginBottom: 'var(--space-3xl)',
          }}
        >
          {/* Brand Column */}
          <div style={{ gridColumn: 'span 1' }}>
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 800,
                fontSize: '1.15rem',
                letterSpacing: '-0.03em',
                marginBottom: 'var(--space-md)',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                }}
              >
                R
              </span>
              Recurrsive
            </Link>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-tertiary)',
                lineHeight: 1.6,
                maxWidth: '240px',
              }}
            >
              Engineering Intelligence Platform. Understand your entire system. Make better decisions.
            </p>
            {/* Social */}
            <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--space-lg)' }}>
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <s.icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--space-md)',
                }}
              >
                {title}
              </h4>
              <ul style={{ listStyle: 'none' }}>
                {links.map((link) => (
                  <li key={link.label} style={{ marginBottom: '10px' }}>
                    <Link
                      href={link.href}
                      style={{
                        fontSize: '0.88rem',
                        color: 'var(--text-secondary)',
                        transition: 'color var(--transition-fast)',
                      }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-xl)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-md)',
          }}
        >
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            © {new Date().getFullYear()} Talomia. All rights reserved.
          </p>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Made with <Heart size={12} style={{ color: 'var(--red)' }} /> for engineering teams
          </p>
        </div>
      </div>
    </footer>
  );
}
