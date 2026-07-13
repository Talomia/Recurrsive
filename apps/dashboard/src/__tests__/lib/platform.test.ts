import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSecret, rotateSecret } from '../../lib/api/platform';

function respond(data: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ data }),
  });
}

describe('platform API contracts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends rotation intervals when creating encrypted local secrets', async () => {
    respond({ id: 'secret-1', key: 'API_KEY', backend: 'local' });
    await createSecret({ key: 'API_KEY', value: 'initial', rotationIntervalDays: 30 });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/secrets'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'API_KEY', value: 'initial', rotationIntervalDays: 30 }),
      }),
    );
  });

  it('requires the replacement value in secret rotation requests', async () => {
    respond({ id: 'secret-1', key: 'API_KEY', backend: 'local', version: 2 });
    await rotateSecret('secret-1', 'replacement');
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/secrets/secret-1/rotate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ newValue: 'replacement' }),
      }),
    );
  });
});
