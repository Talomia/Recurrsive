import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../../components/sidebar';

// Mock useActiveProject
vi.mock('../../components/active-project-context', () => ({
  useActiveProject: () => ({
    projects: [
      { id: 'proj-1', name: 'Service A', slug: 'service-a', language: 'TypeScript' },
      { id: 'proj-2', name: 'Service B', slug: 'service-b', language: 'Python' }
    ],
    activeProject: { id: 'proj-1', name: 'Service A', slug: 'service-a', language: 'TypeScript' },
    loading: false,
    switchProject: vi.fn(),
  }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the Recurrsive brand', () => {
    render(<Sidebar />);
    expect(screen.getByText('Recurrsive')).toBeInTheDocument();
  });

  it('renders consolidated section headers', () => {
    render(<Sidebar />);
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('renders navigation items within default expanded sections', () => {
    render(<Sidebar />);
    // Intelligence section (expanded by default)
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Forecasting')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Comparisons')).toBeInTheDocument();

    // Analysis section (expanded by default)
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('System Map')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('renders operations and administration pages when expanded', () => {
    render(<Sidebar />);

    // Expand Operations
    const operationsButton = screen.getByRole('button', { name: /Operations/i });
    fireEvent.click(operationsButton);

    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getByText('Scheduling')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Experiments')).toBeInTheDocument();
    expect(screen.getByText('Simulation')).toBeInTheDocument();
    expect(screen.getByText('Snapshots')).toBeInTheDocument();

    // Expand Administration
    const adminButton = screen.getByRole('button', { name: /Administration/i });
    fireEvent.click(adminButton);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Policies')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('Data Masking')).toBeInTheDocument();
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(screen.getByText('SSO')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
  });

  it('renders navigation links as anchor elements', () => {
    render(<Sidebar />);
    // By default, only expanded section links are visible (10 links)
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(10);
  });

  it('renders all links when all sections are expanded', () => {
    render(<Sidebar />);

    const operationsButton = screen.getByRole('button', { name: /Operations/i });
    const adminButton = screen.getByRole('button', { name: /Administration/i });

    fireEvent.click(operationsButton);
    fireEvent.click(adminButton);

    const links = screen.getAllByRole('link');
    // 5 (Intelligence) + 5 (Analysis) + 7 (Operations) + 12 (Administration) = 29 items
    expect(links.length).toBe(29);
  });
});


