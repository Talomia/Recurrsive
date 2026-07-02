import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/link to render as a plain anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import ProductPage from '@/app/product/page';

describe('Product Page', () => {
  it('renders without crashing', () => {
    render(<ProductPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero heading', () => {
    render(<ProductPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1[0].textContent).toMatch(/Engineering Intelligence/i);
  });

  it('renders the Full-System Intelligence badge', () => {
    render(<ProductPage />);
    const matches = screen.getAllByText(/Full-System Intelligence/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders pipeline step titles', () => {
    render(<ProductPage />);
    const stepTitles = ['Collect', 'Understand', 'Reason', 'Evolve'];
    for (const title of stepTitles) {
      const matches = screen.getAllByText(title);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders collector names', () => {
    render(<ProductPage />);
    const collectorNames = ['Git', 'GitHub', 'OpenTelemetry', 'Cloud Cost'];
    for (const name of collectorNames) {
      const matches = screen.getAllByText(name);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders analyzer names', () => {
    render(<ProductPage />);
    const analyzerNames = ['Architecture', 'Performance', 'Security', 'Cost'];
    for (const name of analyzerNames) {
      const matches = screen.getAllByText(name);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders the hero description', () => {
    render(<ProductPage />);
    const matches = screen.getAllByText(/knowledge graph of your entire software system/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
