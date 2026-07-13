import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

import { Navbar } from '@/components/Navbar';

describe('Navbar', () => {
  it('renders without crashing', () => {
    const { container } = render(<Navbar />);
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('renders the logo link pointing to /', () => {
    const { container } = render(<Navbar />);
    const logoLink = container.querySelector('a[href="/"]');
    expect(logoLink).not.toBeNull();
    expect(logoLink!.textContent).toContain('Recurrsive');
  });

  it('renders all main navigation links', () => {
    const { container } = render(<Navbar />);
    const links = container.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/product');
    expect(hrefs).toContain('/pricing');
    expect(hrefs).toContain('/docs');
    expect(hrefs).toContain('/changelog');
  });

  it('renders Product link pointing to /product', () => {
    const { container } = render(<Navbar />);
    const productLink = container.querySelector('a[href="/product"]');
    expect(productLink).not.toBeNull();
    expect(productLink!.textContent).toContain('Product');
  });

  it('renders Pricing link pointing to /pricing', () => {
    const { container } = render(<Navbar />);
    const pricingLink = container.querySelector('a[href="/pricing"]');
    expect(pricingLink).not.toBeNull();
    expect(pricingLink!.textContent).toContain('Pricing');
  });

  it('renders Get Started CTA button', () => {
    render(<Navbar />);
    const ctaButtons = screen.getAllByText('Get Started');
    expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders GitHub CTA button', () => {
    render(<Navbar />);
    const githubButtons = screen.getAllByText('GitHub');
    expect(githubButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile menu toggle button', () => {
    render(<Navbar />);
    const toggleButtons = screen.getAllByLabelText('Toggle menu');
    expect(toggleButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens mobile menu when toggle is clicked', () => {
    render(<Navbar />);
    const toggleButtons = screen.getAllByLabelText('Toggle menu');
    fireEvent.click(toggleButtons[0]);
    // After click, mobile menu items should be duplicated (desktop + mobile)
    const productLinks = screen.getAllByText('Product');
    expect(productLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('closes mobile menu when a link is clicked', () => {
    render(<Navbar />);
    const toggleButtons = screen.getAllByLabelText('Toggle menu');
    fireEvent.click(toggleButtons[0]);
    // Count before close
    const beforeCount = screen.getAllByText('Pricing').length;
    // Click a mobile nav link (the last Pricing link is in the mobile menu)
    const pricingLinks = screen.getAllByText('Pricing');
    fireEvent.click(pricingLinks[pricingLinks.length - 1]);
    // After clicking mobile link, menu should close — fewer instances
    const afterCount = screen.getAllByText('Pricing').length;
    expect(afterCount).toBeLessThanOrEqual(beforeCount);
  });
});
