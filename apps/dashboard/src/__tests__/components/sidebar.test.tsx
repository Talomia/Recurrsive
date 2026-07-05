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

  it('renders section headers', () => {
    render(<Sidebar />);
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Cloud')).toBeInTheDocument();
  });

  it('renders navigation items within sections', () => {
    render(<Sidebar />);
    // Intelligence section
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Executive')).toBeInTheDocument();
    expect(screen.getByText('Forecasting')).toBeInTheDocument();
    // Analysis section
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('renders operations and integration pages', () => {
    render(<Sidebar />);
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
  });

  it('renders admin and enterprise pages', () => {
    render(<Sidebar />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(screen.getByText('SSO')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Partners')).toBeInTheDocument();
  });

  it('renders navigation links as anchor elements', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(20);
  });
});
