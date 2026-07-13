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

  it('renders the Production Support tier', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Production Support');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const customMatches = screen.getAllByText('Custom');
    expect(customMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Implementation Services tier', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Implementation Services');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const priceMatches = screen.getAllByText('Custom');
    expect(priceMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders CTA buttons for each plan', () => {
    render(<PricingPage />);
    const getStarted = screen.getAllByText('Get Started Free');
    const discussSupport = screen.getAllByText('Discuss Support');
    const planEngagement = screen.getAllByText('Plan an Engagement');
    expect(getStarted.length).toBeGreaterThanOrEqual(1);
    expect(discussSupport.length).toBeGreaterThanOrEqual(1);
    expect(planEngagement.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Most Popular badge on Production Support', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Most Popular');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders key Open Source features', () => {
    render(<PricingPage />);
    const collectors = screen.getAllByText('14 data collectors');
    const analyzers = screen.getAllByText('13 built-in analyzers');
    const cli = screen.getAllByText('CLI for analysis and operations');
    expect(collectors.length).toBeGreaterThanOrEqual(1);
    expect(analyzers.length).toBeGreaterThanOrEqual(1);
    expect(cli.length).toBeGreaterThanOrEqual(1);
  });

  it('renders key Production Support features', () => {
    render(<PricingPage />);
    expect(screen.getAllByText('Backup and restore runbooks').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Security configuration guidance').length).toBeGreaterThanOrEqual(1);
  });

  it('renders key Implementation Services features', () => {
    render(<PricingPage />);
    expect(screen.getAllByText('Collector and analyzer integration').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Acceptance criteria and handoff').length).toBeGreaterThanOrEqual(1);
  });

  it('renders FAQ section', () => {
    render(<PricingPage />);
    const faq = screen.getAllByText('Why no per-seat pricing?');
    expect(faq.length).toBeGreaterThanOrEqual(1);
  });
});
