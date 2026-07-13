/**
 * Tests for the Header component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../../components/header';

// Mock the shared realtime connection
vi.mock('../../components/realtime-context', () => ({
  useRealtime: () => ({
    status: 'connected' as const,
    clientCount: 3,
    lastMessage: null,
    lastEvent: null,
    events: [],
    send: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock LiveIndicator
vi.mock('../../components/LiveIndicator', () => ({
  LiveIndicator: ({ status }: { status: string }) => (
    <span data-testid="live-indicator">{status}</span>
  ),
}));

// Mock useAuth
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { userId: 'user-abc123', username: 'admin', role: 'admin' },
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

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title', () => {
    render(<Header title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders title and subtitle', () => {
    render(<Header title="Analytics" subtitle="Performance metrics" />);
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Performance metrics')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<Header title="Test" />);
    const searchInput = screen.getByLabelText('Search dashboard');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', 'Search everything…');
  });

  it('renders user avatar with initials', () => {
    render(<Header title="Test" />);
    expect(screen.getByLabelText('User avatar: admin')).toBeInTheDocument();
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('renders notification button', () => {
    render(<Header title="Test" />);
    expect(screen.getByLabelText('View notifications')).toBeInTheDocument();
  });

  it('renders AI assist button', () => {
    render(<Header title="Test" />);
    expect(screen.getByLabelText('Open analysis search')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Analysis Search' })).not.toBeInTheDocument();
  });

  it('mounts the analysis dialog only while it is open', () => {
    render(<Header title="Test" />);
    fireEvent.click(screen.getByLabelText('Open analysis search'));
    expect(screen.getByRole('dialog', { name: 'Analysis Search' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close analysis search'));
    expect(screen.queryByRole('dialog', { name: 'Analysis Search' })).not.toBeInTheDocument();
  });

  it('toggles user menu on click', () => {
    render(<Header title="Test" />);
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('handles search input', () => {
    render(<Header title="Test" />);
    const searchInput = screen.getByLabelText('Search dashboard');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    expect(searchInput).toHaveValue('test query');
  });

  it('renders live indicator', () => {
    render(<Header title="Test" />);
    expect(screen.getByTestId('live-indicator')).toBeInTheDocument();
  });
});
