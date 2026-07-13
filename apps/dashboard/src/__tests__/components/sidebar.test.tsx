import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from '../../components/sidebar';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/api/client', () => ({
  apiFetch: apiFetchMock,
}));

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
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ data: [], total: 12 });
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

  it('loads the active project opportunity total from the raw API envelope', async () => {
    render(<Sidebar />);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/v1/opportunities?limit=1&projectId=proj-1',
        { unwrap: false },
      );
    });
    expect(screen.getByText('12')).toBeInTheDocument();
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
    expect(screen.getByText('SSO')).toBeInTheDocument();
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
    // Current production navigation across all expanded sections.
    expect(links.length).toBe(25);
  });
});
