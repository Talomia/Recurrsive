import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';

// Ensure cleanup between tests
afterEach(() => {
  cleanup();
});

// Mock next/link to render as a plain anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('renders without crashing', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('footer')).toBeInTheDocument();
  });

  it('renders the brand name', () => {
    render(<Footer />);
    const matches = screen.getAllByText('Recurrsive');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders all footer section headings', () => {
    render(<Footer />);
    const footer = screen.getAllByRole('contentinfo')[0];
    const headings = within(footer).getAllByRole('heading', { level: 4 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain('Product');
    expect(headingTexts).toContain('Resources');
    expect(headingTexts).toContain('Partners');
    expect(headingTexts).toContain('Company');
  });

  it('renders key product links', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    const links = footer.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/product');
    expect(hrefs).toContain('/pricing');
    expect(hrefs).toContain('/marketplace');
    expect(hrefs).toContain('/cloud');
    expect(hrefs).toContain('/changelog');
  });

  it('renders key resources links', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    const links = footer.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/docs');
    expect(hrefs).toContain('/docs/getting-started');
    expect(hrefs).toContain('/docs/api-reference');
    expect(hrefs).toContain('/docs/cli-reference');
    expect(hrefs).toContain('/docs/plugin-sdk');
  });

  it('renders partner links', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    const links = footer.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/partners');
    expect(hrefs).toContain('/partners/directory');
    expect(hrefs).toContain('/partners/certification');
  });

  it('renders company links', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    const links = footer.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/about');
    expect(hrefs).toContain('/contact');
  });

  it('renders copyright text with current year', () => {
    const { container } = render(<Footer />);
    const year = new Date().getFullYear();
    expect(container.textContent).toContain(`© ${year} Talomia`);
  });

  it('renders the tagline about engineering teams', () => {
    const { container } = render(<Footer />);
    expect(container.textContent).toContain('for engineering teams');
  });

  it('renders social links with external targets', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    const externalLinks = footer.querySelectorAll('a[target="_blank"]');
    expect(externalLinks.length).toBeGreaterThanOrEqual(4);
  });

  it('renders GitHub social link with correct href', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    const githubLink = footer.querySelector('a[href="https://github.com/Talomia/Recurrsive"]');
    expect(githubLink).not.toBeNull();
  });
});
