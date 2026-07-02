/**
 * Tests for the AuthGuard component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from '../../components/auth-guard';

// Track mock values so we can change them per test
let mockUser: { id: string; username: string; role: string } | null = null;
let mockLoading = false;
const mockReplace = vi.fn();

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    token: mockUser ? 'token' : null,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    mockUser = null;
    mockLoading = false;
    mockReplace.mockClear();
  });

  it('shows loading spinner when auth is loading', () => {
    mockLoading = true;
    render(<AuthGuard><div>Protected</div></AuthGuard>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    mockUser = null;
    render(<AuthGuard><div>Protected</div></AuthGuard>);
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockUser = { id: '1', username: 'admin', role: 'admin' };
    render(<AuthGuard><div>Protected</div></AuthGuard>);
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('does not redirect when user is authenticated', () => {
    mockUser = { id: '1', username: 'admin', role: 'admin' };
    render(<AuthGuard><div>Protected</div></AuthGuard>);
    expect(mockReplace).not.toHaveBeenCalledWith('/login');
  });
});
