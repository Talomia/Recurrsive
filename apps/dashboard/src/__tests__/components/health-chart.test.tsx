/**
 * Tests for the HealthChart component.
 *
 * Mocks recharts to test data handling and series rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthChart from '../../components/health-chart';
import type { TimelinePoint } from '../../lib/api';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="area-chart" data-points={data.length}>{children}</div>
  ),
  Area: ({ dataKey, stroke }: { dataKey: string; stroke: string }) => (
    <div data-testid={`area-${dataKey}`} data-stroke={stroke} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const SAMPLE_DATA: TimelinePoint[] = [
  { date: '2024-01-01', healthScore: 85, quality: 80, reliability: 90, performance: 75 },
  { date: '2024-01-02', healthScore: 87, quality: 82, reliability: 88, performance: 78 },
  { date: '2024-01-03', healthScore: 90, quality: 85, reliability: 92, performance: 80 },
];

describe('HealthChart', () => {
  it('renders chart container', () => {
    render(<HealthChart data={SAMPLE_DATA} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders area chart with data', () => {
    render(<HealthChart data={SAMPLE_DATA} />);
    const chart = screen.getByTestId('area-chart');
    expect(chart).toHaveAttribute('data-points', '3');
  });

  it('renders all four series areas', () => {
    render(<HealthChart data={SAMPLE_DATA} />);
    expect(screen.getByTestId('area-healthScore')).toBeInTheDocument();
    expect(screen.getByTestId('area-quality')).toBeInTheDocument();
    expect(screen.getByTestId('area-reliability')).toBeInTheDocument();
    expect(screen.getByTestId('area-performance')).toBeInTheDocument();
  });

  it('uses correct colors for each series', () => {
    render(<HealthChart data={SAMPLE_DATA} />);
    expect(screen.getByTestId('area-healthScore')).toHaveAttribute('data-stroke', '#3b82f6');
    expect(screen.getByTestId('area-quality')).toHaveAttribute('data-stroke', '#8b5cf6');
    expect(screen.getByTestId('area-reliability')).toHaveAttribute('data-stroke', '#22c55e');
    expect(screen.getByTestId('area-performance')).toHaveAttribute('data-stroke', '#22d3ee');
  });

  it('renders grid and axes', () => {
    render(<HealthChart data={SAMPLE_DATA} />);
    expect(screen.getByTestId('grid')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
  });

  it('renders legend labels', () => {
    render(<HealthChart data={SAMPLE_DATA} />);
    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Reliability')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
  });
});
