/**
 * Tests for the Header component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../../components/header';

// Mock useWebSocket
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    status: 'connected' as const,
    clientCount: 3,
    lastMessage: null,
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
    token: 'mock-token',
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock useAssistant (AI availability context)
vi.mock('../../components/assistant-context', () => ({
  useAssistant: () => ({
    availability: 'unknown',
    reason: null,
    reportStatus: vi.fn(),
  }),
  AssistantProvider: ({ children }: { children: unknown }) => children,
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
    expect(screen.getByLabelText('Open AI assistant')).toBeInTheDocument();
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

  it('renders no breadcrumb nav by default', () => {
    render(<Header title="Test" />);
    expect(screen.queryByLabelText('Breadcrumb')).not.toBeInTheDocument();
  });

  it('renders breadcrumbs with links for ancestors and text for the current page', () => {
    render(
      <Header
        title="Finding Detail"
        breadcrumbs={[
          { label: 'Findings', href: '/findings' },
          { label: '#F-123' },
        ]}
      />
    );
    const nav = screen.getByLabelText('Breadcrumb');
    expect(nav).toBeInTheDocument();
    const link = screen.getByText('Findings');
    expect(link.closest('a')).toHaveAttribute('href', '/findings');
    const current = screen.getByText('#F-123');
    expect(current.closest('a')).toBeNull();
  });

  it('renders a primary action as a link when href is given', () => {
    render(
      <Header
        title="Overview"
        primaryAction={{ label: 'New Analysis', href: '/projects' }}
      />
    );
    const action = screen.getByText('New Analysis');
    expect(action.closest('a')).toHaveAttribute('href', '/projects');
  });

  it('renders a primary action as a button and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <Header
        title="Projects"
        primaryAction={{ label: 'New Project', onClick }}
      />
    );
    const button = screen.getByRole('button', { name: 'New Project' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the primary action when disabled is set', () => {
    const onClick = vi.fn();
    render(
      <Header
        title="Project"
        primaryAction={{ label: 'Analyzing…', onClick, disabled: true }}
      />
    );
    const button = screen.getByRole('button', { name: 'Analyzing…' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
