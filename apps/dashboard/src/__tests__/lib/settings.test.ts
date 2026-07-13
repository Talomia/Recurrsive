import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMaskingPolicy, deleteMaskingPolicy, updateMaskingPolicy } from '../../lib/api/settings';

function respond(data: unknown = null, status = 200) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(data === null ? null : { data }),
  });
}

describe('settings API contracts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and updates masking policies with server field names', async () => {
    const policy = {
      fieldPattern: '*.email', piiType: 'email', strategy: 'partial' as const,
      enabled: true, reason: 'Protect contacts',
    };
    respond({ id: 'policy-1', ...policy, createdAt: '2026-01-01' }, 201);
    await createMaskingPolicy(policy);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/data-masking/policies'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(policy) }),
    );

    respond({ id: 'policy-1', ...policy, enabled: false, createdAt: '2026-01-01' });
    await updateMaskingPolicy('policy-1', { enabled: false });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/data-masking/policies/policy-1'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ enabled: false }) }),
    );
  });

  it('deletes masking policies without expecting a JSON body', async () => {
    respond(null, 204);
    await deleteMaskingPolicy('policy-1');
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/data-masking/policies/policy-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
