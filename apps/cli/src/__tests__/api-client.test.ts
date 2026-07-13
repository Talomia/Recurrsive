import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('CLI API client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('RECURRSIVE_SERVER', 'https://api.example.test/');
    vi.stubEnv('RECURRSIVE_TOKEN', 'test-token');
    vi.stubEnv('RECURRSIVE_API_KEY', '');
    vi.stubEnv('RECURRSIVE_PROJECT_ID', 'project-default');
    vi.stubEnv('HOME', '/tmp/recurrsive-cli-test-home');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ data: [{ id: 'project-1' }], total: 1 }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('adds authentication, project scope, and unwraps standard envelopes', async () => {
    const { apiRequest } = await import('../config.js');
    const result = await apiRequest<Array<{ id: string }>>('/api/v1/analytics/summary');
    expect(result).toEqual([{ id: 'project-1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/analytics/summary?projectId=project-default',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('allows an explicit project ID to override the environment', async () => {
    const { apiRequest } = await import('../config.js');
    await apiRequest('/api/v1/export/history?limit=2', { projectId: 'project-explicit' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/export/history?limit=2&projectId=project-explicit',
      expect.any(Object),
    );
  });

  it('supports API-key authentication', async () => {
    vi.stubEnv('RECURRSIVE_TOKEN', '');
    vi.stubEnv('RECURRSIVE_API_KEY', 'rk_test_key');
    const { apiRequest } = await import('../config.js');
    await apiRequest('/api/v1/projects');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'rk_test_key' }),
      }),
    );
  });

  it('returns undefined for successful no-content responses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' });
    const { apiRequest } = await import('../config.js');
    await expect(apiRequest('/api/v1/webhooks/wh_1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
