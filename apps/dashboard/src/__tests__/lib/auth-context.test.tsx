/**
 * Tests for the auth context — AuthProvider and useAuth hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../lib/auth-context';

// Test consumer component
function AuthConsumer() {
  const { user, loading, error, token } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>Not authenticated</div>;
  return (
    <div>
      <span data-testid="user">{user.username}</span>
      <span data-testid="role">{user.role}</span>
      <span data-testid="token">{token}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('starts with no user when no token stored', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });

  it('resolves to not authenticated when token refresh fails', async () => {
    localStorage.setItem('recurrsive_token', 'fake-token');
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
      status: 401,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });

  it('exports useAuth hook', () => {
    // useAuth should throw when used outside provider
    expect(() => {
      render(<AuthConsumer />);
    }).toThrow();
  });
});
