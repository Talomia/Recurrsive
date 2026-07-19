/**
 * Tests for the OpportunitiesList component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OpportunitiesList from '../../components/opportunities-list';
import type { Opportunity } from '../../lib/api';

// Mock CategoryBadge and SeverityBadge
vi.mock('@/components/category-badge', () => ({
  default: ({ category }: { category: string }) => (
    <span data-testid="category-badge">{category}</span>
  ),
  SeverityBadge: ({ severity }: { severity: string }) => (
    <span data-testid="severity-badge">{severity}</span>
  ),
}));

// Honest shape mapped from the real core Opportunity (confidence 0–1, effort
// is a t-shirt object, no fabricated score/impact/roi constants).
function makeOpp(over: Partial<Opportunity> & Pick<Opportunity, 'id' | 'title' | 'confidence'>): Opportunity {
  return {
    problem: 'problem',
    recommendation: 'do the thing',
    categories: ['refactoring'],
    severity: 'high',
    status: 'proposed',
    score: null,
    effort: { tShirt: 'm', estimatedHours: null, estimatedDays: null, skillsRequired: [], dependencies: [] },
    riskLevel: 'low',
    riskDescription: null,
    impactSummary: null,
    impactMetrics: [],
    affectedServices: [],
    evidence: [],
    locations: [],
    createdAt: '2024-01-01',
    ...over,
  };
}

const SAMPLE_OPPORTUNITIES: Opportunity[] = [
  makeOpp({ id: 'opp-1', title: 'Extract shared utilities', confidence: 0.9, categories: ['refactoring'], severity: 'high' }),
  makeOpp({ id: 'opp-2', title: 'Add error boundaries', confidence: 0.85, categories: ['reliability'], severity: 'medium' }),
  makeOpp({ id: 'opp-3', title: 'Optimize re-renders', confidence: 0.75, categories: ['performance'], severity: 'low' }),
];

describe('OpportunitiesList', () => {
  it('renders section title', () => {
    render(<OpportunitiesList opportunities={SAMPLE_OPPORTUNITIES} />);
    expect(screen.getByText('Top Opportunities')).toBeInTheDocument();
  });

  it('renders opportunity titles', () => {
    render(<OpportunitiesList opportunities={SAMPLE_OPPORTUNITIES} />);
    expect(screen.getByText('Extract shared utilities')).toBeInTheDocument();
    expect(screen.getByText('Add error boundaries')).toBeInTheDocument();
    expect(screen.getByText('Optimize re-renders')).toBeInTheDocument();
  });

  it('renders real confidence percentages (not a fabricated score)', () => {
    render(<OpportunitiesList opportunities={SAMPLE_OPPORTUNITIES} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders category badges', () => {
    render(<OpportunitiesList opportunities={SAMPLE_OPPORTUNITIES} />);
    const badges = screen.getAllByTestId('category-badge');
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it('renders severity badges', () => {
    render(<OpportunitiesList opportunities={SAMPLE_OPPORTUNITIES} />);
    const badges = screen.getAllByTestId('severity-badge');
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it('limits display to 5 opportunities', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...SAMPLE_OPPORTUNITIES[0],
      id: `opp-${i}`,
      title: `Opportunity ${i}`,
    }));
    render(<OpportunitiesList opportunities={many} />);
    // Should show max 5
    expect(screen.getByText('Opportunity 0')).toBeInTheDocument();
    expect(screen.getByText('Opportunity 4')).toBeInTheDocument();
    expect(screen.queryByText('Opportunity 5')).not.toBeInTheDocument();
  });

  it('renders view all link', () => {
    render(<OpportunitiesList opportunities={SAMPLE_OPPORTUNITIES} />);
    const viewAll = screen.getByText('Explore All Opportunities');
    expect(viewAll.closest('a')).toHaveAttribute('href', '/opportunities');
  });
});
