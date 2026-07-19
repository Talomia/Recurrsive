/**
 * Security-hardening unit tests.
 *
 * Covers:
 * - authenticateUser performs a dummy scrypt comparison for unknown/disabled
 *   users so response timing does not reveal account existence.
 * - deliverWebhook never follows HTTP redirects (redirect: 'manual'), so a
 *   3xx from a validated webhook target cannot bounce the request to an
 *   internal host.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — BEFORE any app imports
// ---------------------------------------------------------------------------

vi.mock('@recurrsive/core', () => {
  let counter = 0;
  return {
    createLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    generateId: vi.fn().mockImplementation(() => `sec-test-id-${++counter}`),
    nowISO: vi.fn().mockImplementation(() => new Date().toISOString()),
  };
});

// Wrap the real password module so verifyPassword keeps its behavior but the
// number of scrypt derivations per authentication attempt can be asserted.
vi.mock('../middleware/passwords.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/passwords.js')>();
  return {
    ...actual,
    verifyPassword: vi.fn(actual.verifyPassword),
  };
});

import { verifyPassword } from '../middleware/passwords.js';
import { authenticateUser, createUser, updateUser, findUserByUsername } from '../middleware/users.js';
import { deliverWebhook, type WebhookPayload } from '../routes/webhooks.js';

const verifyPasswordMock = verifyPassword as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// authenticateUser — timing-enumeration resistance
// ---------------------------------------------------------------------------

describe('authenticateUser — timing-enumeration resistance', () => {
  afterEach(() => {
    verifyPasswordMock.mockClear();
  });

  it('performs a dummy scrypt comparison when the username does not exist', async () => {
    const result = await authenticateUser('no-such-user-anywhere', 'any-password');
    expect(result).toBeNull();
    // Exactly one full scrypt derivation ran — same cost as a real
    // wrong-password attempt, so timing does not reveal user existence.
    expect(verifyPasswordMock).toHaveBeenCalledTimes(1);
  });

  it('performs a dummy scrypt comparison for a disabled account', async () => {
    await createUser({
      username: 'disabled-timing-user',
      email: 'disabled-timing@test.dev',
      password: 'valid-password-123',
      role: 'viewer',
    });
    const created = await findUserByUsername('disabled-timing-user');
    expect(created).toBeDefined();
    await updateUser(created!.id, { status: 'disabled' });

    verifyPasswordMock.mockClear();
    const result = await authenticateUser('disabled-timing-user', 'valid-password-123');
    expect(result).toBeNull();
    expect(verifyPasswordMock).toHaveBeenCalledTimes(1);
    // The dummy pair, never the account's real hash, is used for the burn —
    // a disabled account's credentials must not be verifiable at all.
    const [, hashArg] = verifyPasswordMock.mock.calls[0] as [string, string, string];
    expect(hashArg).toBe('00'.repeat(64));
  });

  it('still authenticates a valid active user', async () => {
    await createUser({
      username: 'active-timing-user',
      email: 'active-timing@test.dev',
      password: 'valid-password-123',
      role: 'viewer',
    });

    verifyPasswordMock.mockClear();
    const result = await authenticateUser('active-timing-user', 'valid-password-123');
    expect(result).not.toBeNull();
    expect(result!.username).toBe('active-timing-user');
    expect(verifyPasswordMock).toHaveBeenCalledTimes(1);
  });

  it('still rejects a wrong password for a valid user', async () => {
    const result = await authenticateUser('active-timing-user', 'wrong-password');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deliverWebhook — redirects are never followed
// ---------------------------------------------------------------------------

describe('deliverWebhook — redirect handling', () => {
  const payload: WebhookPayload = {
    event: 'analysis.complete',
    timestamp: new Date().toISOString(),
    data: { test: true },
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends requests with redirect: "manual"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK' });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await deliverWebhook('https://hooks.example.com/receiver', undefined, payload);
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.example.com/receiver',
      expect.objectContaining({ method: 'POST', redirect: 'manual' }),
    );
  });

  it('treats a 3xx redirect as a failed delivery instead of following it', async () => {
    // With redirect: 'manual', fetch resolves with the 3xx response itself.
    const fetchMock = vi.fn().mockResolvedValue({
      status: 302,
      statusText: 'Found',
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await deliverWebhook('https://hooks.example.com/receiver', 'hmac-secret', payload);
    expect(result.success).toBe(false);
    expect(result.status_code).toBe(302);
    expect(result.error).toMatch(/302/);
    // Exactly one request — the redirect target is never fetched.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
