/**
 * Tests for the Providers component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers } from '../../components/providers';

// Mock AuthProvider and AuthGuard to isolate Providers component
vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
  useAuth: () => ({
    user: { id: '1', username: 'admin', role: 'admin' },
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/active-project-context', () => ({
  ActiveProjectProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-guard">{children}</div>
  ),
}));

vi.mock('@/components/realtime-context', () => ({
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="realtime-provider">{children}</div>
  ),
}));

describe('Providers', () => {
  it('renders children inside provider hierarchy', () => {
    render(
      <Providers>
        <div data-testid="child">Hello</div>
      </Providers>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('wraps children in AuthProvider', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>
    );
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('wraps children in AuthGuard', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>
    );
    expect(screen.getByTestId('auth-guard')).toBeInTheDocument();
  });

  it('nests AuthGuard inside AuthProvider', () => {
    render(
      <Providers>
        <div>Content</div>
      </Providers>
    );
    const authProvider = screen.getByTestId('auth-provider');
    const authGuard = screen.getByTestId('auth-guard');
    expect(authProvider.contains(authGuard)).toBe(true);
  });
});
