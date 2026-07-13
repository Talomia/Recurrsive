import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/link to render as a plain anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import HomePage from '@/app/page';

describe('Landing Page', () => {
  it('renders without crashing', () => {
    render(<HomePage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero heading with key text', () => {
    render(<HomePage />);
    const h1Elements = screen.getAllByRole('heading', { level: 1 });
    const heroH1 = h1Elements[0];
    expect(heroH1.textContent).toMatch(/Understand what your system shows/i);
    expect(heroH1.textContent).toMatch(/without pretending to know more/i);
  });

  it('renders the evidence-based product badge', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/Evidence-Based Engineering Intelligence/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero description text', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/does not fabricate load tests/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the deployment CTA button', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/Deploy Recurrsive/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const ctaLink = matches[0].closest('a');
    expect(ctaLink).toHaveAttribute('href', '/docs/getting-started');
  });

  it('renders the source CTA button', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/Inspect the Source/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the product contract section', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/Evidence first, uncertainty visible/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the evidence guarantees', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/Opportunity effort, risk, and impact stay unknown/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Capabilities section', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/A production surface you can verify/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders an uncertainty-aware sample output', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/unknown until measured/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
