import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/link to render as a plain anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import PricingPage from '@/app/pricing/page';

describe('Pricing Page', () => {
  it('renders without crashing', () => {
    render(<PricingPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero heading with Pricing text', () => {
    render(<PricingPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1[0].textContent).toMatch(/Pricing/i);
  });

  it('renders the Open Source (Free) tier', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Open Source');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const freeMatches = screen.getAllByText('Free');
    expect(freeMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Enterprise tier', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Enterprise');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const customMatches = screen.getAllByText('Custom');
    expect(customMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Cloud tier', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Cloud');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const priceMatches = screen.getAllByText('$199');
    expect(priceMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders CTA buttons for each plan', () => {
    render(<PricingPage />);
    const getStarted = screen.getAllByText('Get Started Free');
    const contactSales = screen.getAllByText('Contact Sales');
    const startTrial = screen.getAllByText('Start Free Trial');
    expect(getStarted.length).toBeGreaterThanOrEqual(1);
    expect(contactSales.length).toBeGreaterThanOrEqual(1);
    expect(startTrial.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Most Popular badge on Enterprise', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Most Popular');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders key Open Source features', () => {
    render(<PricingPage />);
    const collectors = screen.getAllByText('14 data collectors');
    const analyzers = screen.getAllByText('13 built-in analyzers (89+ rules)');
    const cli = screen.getAllByText('CLI with 25 commands');
    expect(collectors.length).toBeGreaterThanOrEqual(1);
    expect(analyzers.length).toBeGreaterThanOrEqual(1);
    expect(cli.length).toBeGreaterThanOrEqual(1);
  });

  it('renders key Enterprise features', () => {
    render(<PricingPage />);
    const sso = screen.getAllByText('SSO / SAML integration');
    const rbac = screen.getAllByText('Fine-grained RBAC');
    expect(sso.length).toBeGreaterThanOrEqual(1);
    expect(rbac.length).toBeGreaterThanOrEqual(1);
  });

  it('renders key Cloud features', () => {
    render(<PricingPage />);
    const managed = screen.getAllByText('Fully managed infrastructure');
    const uptime = screen.getAllByText('99.9% uptime SLA');
    expect(managed.length).toBeGreaterThanOrEqual(1);
    expect(uptime.length).toBeGreaterThanOrEqual(1);
  });

  it('renders FAQ section', () => {
    render(<PricingPage />);
    const faq = screen.getAllByText('Why no per-seat pricing?');
    expect(faq.length).toBeGreaterThanOrEqual(1);
  });
});
