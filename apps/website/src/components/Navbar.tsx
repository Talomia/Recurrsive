'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Cloud,
  Users,
  BookOpen,
  DollarSign,
  Rocket,
  Terminal,
  Code,
  Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    label: 'Product',
    href: '/product',
    items: [
      { label: 'Features', href: '/product', icon: Sparkles, desc: 'Full-system engineering intelligence' },
      { label: 'Deploy', href: '/cloud', icon: Cloud, desc: 'Self-hosted production deployment' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  {
    label: 'Docs',
    href: '/docs',
    items: [
      { label: 'Getting Started', href: '/docs/getting-started', icon: Rocket, desc: '5-minute quickstart guide' },
      { label: 'API Reference', href: '/docs/api-reference', icon: Code, desc: 'Live API workflow and authentication' },
      { label: 'CLI Reference', href: '/docs/cli-reference', icon: Terminal, desc: 'Analysis and operations commands' },
      { label: 'All Documentation', href: '/docs', icon: BookOpen, desc: 'Guides, API & architecture' },
    ],
  },
  {
    label: 'Project',
    href: '/changelog',
    items: [
      { label: 'Changelog', href: '/changelog', icon: ExternalLink, desc: 'Release notes & history' },
      { label: 'About', href: '/about', icon: Users, desc: 'Our team & mission' },
      { label: 'Contact', href: '/contact', icon: ExternalLink, desc: 'Get in touch' },
      { label: 'GitHub Discussions', href: 'https://github.com/Talomia/Recurrsive/discussions', icon: ExternalLink, desc: 'Questions and project discussion' },
    ],
  },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  const isItemActive = (item: typeof NAV_ITEMS[number]) => {
    if (!pathname) return false;
    if (pathname === item.href) return true;
    if (item.items) {
      return item.items.some(
        (sub) =>
          pathname === sub.href ||
          (sub.href !== '/' && pathname.startsWith(sub.href))
      );
    }
    return false;
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--nav-height)',
        zIndex: 100,
        background: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <nav
        className="container"
        aria-label="Main navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: '-0.03em',
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
            }}
          >
            R
          </span>
          <span>Recurrsive</span>
        </Link>

        {/* Desktop Nav */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          className="desktop-nav"
        >
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <div
                key={item.label}
                style={{ position: 'relative' }}
                onMouseEnter={() => item.items && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <Link
                  href={item.href}
                  aria-expanded={item.items ? openDropdown === item.label : undefined}
                  aria-haspopup={item.items ? 'true' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    fontWeight: active ? 600 : 500,
                    transition: 'color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpenDropdown(null);
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (item.items) {
                        e.preventDefault();
                        setOpenDropdown(openDropdown === item.label ? null : item.label);
                      }
                    }
                  }}
                  onFocus={() => item.items && setOpenDropdown(item.label)}
                >
                  {item.label}
                  {item.items && <ChevronDown size={14} aria-hidden="true" />}
                </Link>

                {/* Dropdown */}
                {item.items && openDropdown === item.label && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      paddingTop: '8px',
                      zIndex: 50,
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '8px',
                        minWidth: '280px',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      {item.items.map((sub) => {
                        const subActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              borderRadius: 'var(--radius-md)',
                              background: subActive ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                              border: subActive ? '1px solid rgba(124, 58, 237, 0.15)' : '1px solid transparent',
                              transition: 'background var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => {
                              if (!subActive) e.currentTarget.style.background = 'var(--bg-glass-strong)';
                            }}
                            onMouseLeave={(e) => {
                              if (!subActive) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <sub.icon
                              size={20}
                              style={{ color: subActive ? 'var(--text-accent)' : 'var(--text-tertiary)', marginTop: 2 }}
                            />
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: '0.9rem',
                                  color: subActive ? 'var(--text-accent)' : 'var(--text-primary)',
                                  marginBottom: 2,
                                }}
                              >
                                {sub.label}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--text-tertiary)',
                                }}
                              >
                                {sub.desc}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
          className="desktop-nav"
        >
          <Link
            href="https://github.com/Talomia/Recurrsive"
            className="btn btn-secondary btn-sm"
            target="_blank"
          >
            GitHub
          </Link>
          <Link href="/cloud" className="btn btn-primary btn-sm">
            Get Started
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: 8,
          }}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--nav-height)',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-primary)',
            padding: 'var(--space-lg)',
            overflowY: 'auto',
            zIndex: 99,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const topActive = isItemActive(item);
            return (
              <div key={item.label} style={{ marginBottom: 'var(--space-md)' }}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'block',
                    padding: '12px 0',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: topActive ? 'var(--text-accent)' : 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {item.label}
                </Link>
                {item.items?.map((sub) => {
                  const subActive = pathname === sub.href;
                  return (
                    <Link
                      key={sub.label}
                      href={sub.href}
                      onClick={() => setMobileOpen(false)}
                      style={{
                        display: 'block',
                        padding: '10px 0 10px 20px',
                        fontSize: '0.95rem',
                        color: subActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
          <div style={{ marginTop: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link href="https://github.com/Talomia/Recurrsive" className="btn btn-secondary" target="_blank">
              GitHub
            </Link>
            <Link href="/cloud" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
      `}</style>
    </header>
  );
}
