/**
 * Tests for the auth context — AuthProvider and useAuth hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../lib/auth-context';

// Test consumer component
function AuthConsumer() {
  const { user, loading, error } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>Not authenticated</div>;
  return (
    <div>
      <span data-testid="user">{user.username}</span>
      <span data-testid="role">{user.role}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
      status: 401,
    });
  });

  it('renders children', () => {
    render(
      <AuthProvider>
        <div data-testid="child">Hello</div>
      </AuthProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('starts with no user when no server session exists', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });

  it('hydrates the authenticated user from the server session', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'user-1', username: 'admin', role: 'admin' },
      }),
      status: 200,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('admin');
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/me', { cache: 'no-store' });
  });

  it('reports a transient session failure without treating it as logout', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Rate limit exceeded. Try again shortly.' }),
      status: 429,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
    });
  });

  it('exports useAuth hook', () => {
    // useAuth should throw when used outside provider
    expect(() => {
      render(<AuthConsumer />);
    }).toThrow();
  });
});
