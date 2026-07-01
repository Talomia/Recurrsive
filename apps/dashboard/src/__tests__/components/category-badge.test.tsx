/**
 * Tests for CategoryBadge and SeverityBadge components.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CategoryBadge, { SeverityBadge } from '../../components/category-badge';

describe('CategoryBadge', () => {
  it('renders category text', () => {
    render(<CategoryBadge category="Security" />);
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders all known categories', () => {
    const categories = ['Security', 'Performance', 'Cost', 'DevOps', 'Architecture', 'Database', 'Reliability', 'Frontend'];
    const { container } = render(
      <div>
        {categories.map(c => <CategoryBadge key={c} category={c} />)}
      </div>
    );
    categories.forEach(c => {
      expect(screen.getByText(c)).toBeInTheDocument();
    });
    // Each should render as a span
    expect(container.querySelectorAll('span').length).toBe(categories.length);
  });

  it('renders unknown categories with default styling', () => {
    render(<CategoryBadge category="Unknown" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('supports md size', () => {
    render(<CategoryBadge category="Security" size="md" />);
    const badge = screen.getByText('Security');
    expect(badge.className).toContain('text-xs');
  });

  it('defaults to sm size', () => {
    render(<CategoryBadge category="Security" />);
    const badge = screen.getByText('Security');
    expect(badge.className).toContain('text-[10px]');
  });
});

describe('SeverityBadge', () => {
  it('renders severity text', () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('renders all known severities', () => {
    const severities = ['critical', 'high', 'medium', 'low'];
    severities.forEach(s => {
      const { unmount } = render(<SeverityBadge severity={s} />);
      expect(screen.getByText(s)).toBeInTheDocument();
      unmount();
    });
  });

  it('renders unknown severities with medium style', () => {
    render(<SeverityBadge severity="info" />);
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('includes a dot indicator', () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    const dot = container.querySelector('span > span');
    expect(dot).toBeInTheDocument();
    expect(dot?.className).toContain('rounded-full');
  });
});
