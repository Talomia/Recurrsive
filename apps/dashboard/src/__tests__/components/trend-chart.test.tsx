/**
 * Tests for the TrendChart component.
 *
 * Uses mocked recharts components since SVG rendering doesn't
 * work in jsdom.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrendChart from '../../components/trend-chart';

// Mock recharts — SVG rendering isn't available in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <svg data-testid="area-chart" data-points={data.length}>{children}</svg>
  ),
  Area: ({ dataKey, stroke }: { dataKey: string; stroke: string }) => (
    <div data-testid="area" data-key={dataKey} data-stroke={stroke} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
}));

describe('TrendChart', () => {
  const sampleData = [
    { value: 10 },
    { value: 25 },
    { value: 18 },
    { value: 30 },
    { value: 22 },
  ];

  it('renders chart with data', () => {
    render(<TrendChart data={sampleData} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders area with correct data key', () => {
    render(<TrendChart data={sampleData} />);
    const area = screen.getByTestId('area');
    expect(area).toHaveAttribute('data-key', 'value');
  });

  it('uses default blue color', () => {
    render(<TrendChart data={sampleData} />);
    const area = screen.getByTestId('area');
    expect(area).toHaveAttribute('data-stroke', '#3b82f6');
  });

  it('uses custom color when provided', () => {
    render(<TrendChart data={sampleData} color="#10b981" />);
    const area = screen.getByTestId('area');
    expect(area).toHaveAttribute('data-stroke', '#10b981');
  });

  it('returns null for empty data', () => {
    const { container } = render(<TrendChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correct number of data points', () => {
    render(<TrendChart data={sampleData} />);
    const chart = screen.getByTestId('area-chart');
    expect(chart).toHaveAttribute('data-points', '5');
  });
});
