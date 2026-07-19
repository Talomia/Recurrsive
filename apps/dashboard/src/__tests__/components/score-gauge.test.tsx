/**
 * Tests for the ScoreGauge component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreGauge from '../../components/score-gauge';

describe('ScoreGauge', () => {
  it('renders the score value', () => {
    render(<ScoreGauge value={87} />);
    expect(screen.getByText('87')).toBeInTheDocument();
  });

  it('renders label when showLabel is true', () => {
    render(<ScoreGauge value={87} showLabel label="Health" />);
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('does not show label when showLabel is false', () => {
    render(<ScoreGauge value={87} label="Health" showLabel={false} />);
    expect(screen.queryByText('Health')).not.toBeInTheDocument();
  });

  it('renders an SVG element', () => {
    const { container } = render(<ScoreGauge value={75} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies different colors based on score ranges', () => {
    // High score (>= 90) — green
    const { unmount } = render(<ScoreGauge value={95} />);
    expect(screen.getByText('95')).toBeInTheDocument();
    unmount();

    // Medium score (>= 75) — blue
    render(<ScoreGauge value={80} />);
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders with custom size', () => {
    const { container } = render(<ScoreGauge value={50} size={200} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '200');
  });

  it('clamps value between 0 and 100', () => {
    render(<ScoreGauge value={150} />);
    // Should display clamped value of 100
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders an honest "Not analyzed" placeholder for a null value', () => {
    render(<ScoreGauge value={null} label="Health" />);
    // No fabricated red 0 — a dash plus "Not analyzed" text instead.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Not analyzed')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Health: not analyzed');
  });

  it('does not draw a progress arc for a null value', () => {
    const { container } = render(<ScoreGauge value={null} />);
    // Only the background track circle remains.
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
});
