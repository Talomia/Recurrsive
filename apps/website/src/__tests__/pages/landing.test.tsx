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
    expect(heroH1.textContent).toMatch(/Understand Your/i);
    expect(heroH1.textContent).toMatch(/Entire System/i);
  });

  it('renders the Engineering Intelligence Platform badge', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/Engineering Intelligence Platform/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero description text', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/evidence-backed recommendations/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Get Started Free CTA button', () => {
    render(<HomePage />);
    const matches = screen.getAllByText('Get Started Free');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const ctaLink = matches[0].closest('a');
    expect(ctaLink).toHaveAttribute('href', '/docs/getting-started');
  });

  it('renders the View on GitHub CTA button', () => {
    render(<HomePage />);
    const matches = screen.getAllByText('View on GitHub');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Problem section', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/not the full picture/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the How It Works section', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/actionable intelligence/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Capabilities section', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/serious engineering/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Sample Output section', () => {
    render(<HomePage />);
    const matches = screen.getAllByText(/looks like/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
