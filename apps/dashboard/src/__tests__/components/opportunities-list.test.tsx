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

const SAMPLE_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-1',
    title: 'Extract shared utilities',
    description: 'Move common helpers to a shared module',
    categories: ['refactoring'],
    severity: 'high',
    confidence: 90,
    effort: 'unknown',
    estimatedHours: null,
    risk: 'unknown',
    impactSummary: 'Resolve the recorded finding.',
    businessValue: null,
    recommendation: 'Extract the shared utilities.',
    assumptions: [],
    evidence: [],
    affectedComponents: ['utils.ts'],
    solution: [],
    status: 'open',
    createdAt: '2024-01-01',
  },
  {
    id: 'opp-2',
    title: 'Add error boundaries',
    description: 'Components lack error boundaries',
    categories: ['reliability'],
    severity: 'medium',
    confidence: 85,
    effort: 'unknown',
    estimatedHours: null,
    risk: 'unknown',
    impactSummary: 'Resolve the recorded finding.',
    businessValue: null,
    recommendation: 'Add error boundaries.',
    assumptions: [],
    evidence: [],
    affectedComponents: ['App.tsx'],
    solution: [],
    status: 'open',
    createdAt: '2024-01-02',
  },
  {
    id: 'opp-3',
    title: 'Optimize re-renders',
    description: 'Unnecessary re-renders in list components',
    categories: ['performance'],
    severity: 'low',
    confidence: 75,
    effort: 'unknown',
    estimatedHours: null,
    risk: 'unknown',
    impactSummary: 'Resolve the recorded finding.',
    businessValue: null,
    recommendation: 'Review re-render causes.',
    assumptions: [],
    evidence: [],
    affectedComponents: ['List.tsx'],
    solution: [],
    status: 'open',
    createdAt: '2024-01-03',
  },
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

  it('renders recorded confidence', () => {
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
