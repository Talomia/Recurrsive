import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigurationError,
  apiData,
  apiRequest,
  projectScopedPath,
} from '../api.js';

const fetchMock = vi.fn();

describe('MCP API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('RECURRSIVE_API_URL', 'https://api.example.test/');
    vi.stubEnv('RECURRSIVE_API_TOKEN', 'test-token');
    vi.stubEnv('RECURRSIVE_API_KEY', '');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: { ok: true } }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('attaches bearer authentication and unwraps data envelopes', async () => {
    await expect(apiData<{ ok: boolean }>('/api/v1/projects')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/projects',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('uses an API key when no bearer token is configured', async () => {
    vi.stubEnv('RECURRSIVE_API_TOKEN', '');
    vi.stubEnv('RECURRSIVE_API_KEY', 'rk_test_key');
    await apiRequest('/api/v1/projects');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'rk_test_key' }),
      }),
    );
  });

  it('appends explicit project scope without losing existing query parameters', () => {
    expect(projectScopedPath('/api/v1/search?q=auth', 'project one')).toBe(
      '/api/v1/search?q=auth&projectId=project+one',
    );
  });

  it('rejects project-scoped requests when no project is configured', () => {
    vi.stubEnv('RECURRSIVE_PROJECT_ID', '');
    expect(() => projectScopedPath('/api/v1/analytics/summary')).toThrow(ConfigurationError);
  });
});
