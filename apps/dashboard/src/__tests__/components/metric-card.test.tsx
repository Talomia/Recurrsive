/**
 * Tests for the MetricCard component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from '../../components/metric-card';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(
      <MetricCard icon={<span data-testid="icon">📊</span>} label="Health Score" value={87} />
    );
    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
  });

  it('renders suffix when provided', () => {
    render(
      <MetricCard icon={<span>📊</span>} label="Score" value={87} suffix="/100" />
    );
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it('renders positive trend with up arrow', () => {
    render(
      <MetricCard icon={<span>📊</span>} label="Score" value={87} trend={5} />
    );
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('vs last 30 days')).toBeInTheDocument();
  });

  it('renders negative trend with down arrow', () => {
    render(
      <MetricCard icon={<span>📊</span>} label="Score" value={65} trend={-3} />
    );
    expect(screen.getByText('3%')).toBeInTheDocument();
  });

  it('renders custom trend label', () => {
    render(
      <MetricCard icon={<span>📊</span>} label="Score" value={87} trend={5} trendLabel="vs last week" />
    );
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <MetricCard icon={<span>📊</span>} label="Score" value={87}>
        <div data-testid="child">Child content</div>
      </MetricCard>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('does not render trend when undefined', () => {
    render(
      <MetricCard icon={<span>📊</span>} label="Score" value={87} />
    );
    expect(screen.queryByText('vs last 30 days')).not.toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <MetricCard icon={<span data-testid="test-icon">🎯</span>} label="Test" value={42} />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
