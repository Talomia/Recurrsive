import { describe, expect, it } from 'vitest';
import { sanitizeRequestUrl } from '../index.js';

describe('request log URL sanitization', () => {
  it('preserves request paths without query strings', () => {
    expect(sanitizeRequestUrl('/api/v1/projects')).toBe('/api/v1/projects');
  });

  it('removes all query parameters before logging', () => {
    expect(sanitizeRequestUrl('/ws?ticket=opaque-secret&projectId=project-1')).toBe('/ws');
    expect(sanitizeRequestUrl('/invite?token=invite-secret')).toBe('/invite');
  });
});
