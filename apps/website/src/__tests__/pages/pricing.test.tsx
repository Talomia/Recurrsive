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

  it('renders the Enterprise Support tier', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Enterprise Support');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const contactMatches = screen.getAllByText('Contact us');
    expect(contactMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders CTA buttons for each plan', () => {
    render(<PricingPage />);
    const getStarted = screen.getAllByText('Get Started Free');
    const contactUs = screen.getAllByText('Contact Us');
    expect(getStarted.length).toBeGreaterThanOrEqual(1);
    expect(contactUs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Apache 2.0 badge on Open Source', () => {
    render(<PricingPage />);
    const matches = screen.getAllByText('Apache 2.0');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders key Open Source features', () => {
    render(<PricingPage />);
    const collectors = screen.getAllByText('14 data collectors');
    const analyzers = screen.getAllByText('12 built-in analyzers (50+ rules)');
    const cli = screen.getAllByText('CLI with 28 commands');
    expect(collectors.length).toBeGreaterThanOrEqual(1);
    expect(analyzers.length).toBeGreaterThanOrEqual(1);
    expect(cli.length).toBeGreaterThanOrEqual(1);
  });

  it('renders FAQ section', () => {
    render(<PricingPage />);
    const faq = screen.getAllByText('Is Recurrsive really free?');
    expect(faq.length).toBeGreaterThanOrEqual(1);
  });
});
