/**
 * Tests for the Sidebar component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Sidebar from '../../components/sidebar';

describe('Sidebar', () => {
  it('renders the Recurrsive brand', () => {
    render(<Sidebar />);
    expect(screen.getByText('Recurrsive')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Intelligence Overview')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('renders all navigation sections', () => {
    render(<Sidebar />);
    // Core pages
    expect(screen.getByText('Executive View')).toBeInTheDocument();
    expect(screen.getByText('Forecasting')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('System Map')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Simulation')).toBeInTheDocument();
  });

  it('renders operations pages', () => {
    render(<Sidebar />);
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
  });

  it('renders admin pages', () => {
    render(<Sidebar />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
  });

  it('renders navigation links as anchor elements', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(20);
  });
});
