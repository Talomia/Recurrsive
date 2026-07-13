import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from '../../components/sidebar';

const apiFetchMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { userId: 'admin-1', username: 'admin', role: 'admin' as 'admin' | 'analyst' | 'viewer' },
}));

vi.mock('../../lib/api/client', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: authState.user,
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
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
    authState.user = { userId: 'admin-1', username: 'admin', role: 'admin' };
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
    expect(screen.getByText('Governance')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('hides administration navigation from viewers', () => {
    authState.user = { userId: 'viewer-1', username: 'viewer', role: 'viewer' };
    render(<Sidebar />);
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('renders navigation items within default expanded sections', () => {
    render(<Sidebar />);
    // Intelligence section (expanded by default)
    expect(screen.getByText('Overview')).toBeInTheDocument();

    // Analysis section (expanded by default)
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
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
    expect(screen.getByText('Experiments')).toBeInTheDocument();

    const governanceButton = screen.getByRole('button', { name: /Governance/i });
    fireEvent.click(governanceButton);
    expect(screen.getByText('Policies')).toBeInTheDocument();

    // Expand Administration
    const adminButton = screen.getByRole('button', { name: /Administration/i });
    fireEvent.click(adminButton);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('SSO')).toBeInTheDocument();
  });

  it('renders navigation links as anchor elements', () => {
    render(<Sidebar />);
    // By default, only Intelligence and Analysis are expanded.
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(6);
  });

  it('renders all links when all sections are expanded', () => {
    render(<Sidebar />);

    const operationsButton = screen.getByRole('button', { name: /Operations/i });
    const governanceButton = screen.getByRole('button', { name: /Governance/i });
    const adminButton = screen.getByRole('button', { name: /Administration/i });

    fireEvent.click(operationsButton);
    fireEvent.click(governanceButton);
    fireEvent.click(adminButton);

    const links = screen.getAllByRole('link');
    // Current production navigation across all expanded sections.
    expect(links.length).toBe(15);
  });
});
