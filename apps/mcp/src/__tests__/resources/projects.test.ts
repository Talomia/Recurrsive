/**
 * Unit tests for the project resource registration module.
 *
 * Tests cover:
 * - registerProjectResources registers exactly 3 resources
 * - Each resource has correct name, URI, metadata, and handler
 * - Resource handlers return valid MCP content with markdown text
 * - projects-list handler returns project overview table
 * - projects-comparison handler returns dimension comparison
 * - projects-timeline handler returns evolution timeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResource = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: vi.fn(),
    resource: mockResource,
    prompt: vi.fn(),
  })),
}));

vi.mock('../../api.js', () => ({
  apiGet: vi.fn().mockImplementation((path: string) => {
    if (path === '/api/v1/projects') {
      return Promise.resolve([
        { name: 'api-gateway', health: 82, opportunities: 5, lastAnalyzed: '2024-12-28T14:30:00Z' },
        { name: 'web-dashboard', health: 71, opportunities: 9, lastAnalyzed: '2024-12-27T10:15:00Z' },
        { name: 'auth-service', health: 91, opportunities: 2, lastAnalyzed: '2024-12-28T16:00:00Z' },
        { name: 'data-pipeline', health: 64, opportunities: 12, lastAnalyzed: '2024-12-26T08:45:00Z' },
        { name: 'mobile-app', health: 77, opportunities: 7, lastAnalyzed: '2024-12-28T12:00:00Z' },
      ]);
    }
    if (path === '/api/v1/comparisons') {
      return Promise.resolve([
        { name: 'api-gateway', architecture: 85, security: 80, testing: 78, docs: 70, reliability: 88 },
        { name: 'web-dashboard', architecture: 72, security: 68, testing: 75, docs: 60, reliability: 74 },
        { name: 'auth-service', architecture: 90, security: 95, testing: 88, docs: 82, reliability: 92 },
        { name: 'data-pipeline', architecture: 65, security: 58, testing: 62, docs: 50, reliability: 68 },
        { name: 'mobile-app', architecture: 78, security: 74, testing: 80, docs: 65, reliability: 76 },
      ]);
    }
    return Promise.reject(new Error('Unknown path'));
  }),
  apiRequest: vi.fn().mockImplementation((path: string) => {
    if (path === '/api/v1/timeline') {
      return Promise.resolve({
        events: [
          { week: 'W49', apiGw: 75, webDash: 65, auth: 88, dataPipe: 58, mobile: 70 },
          { week: 'W50', apiGw: 78, webDash: 67, auth: 89, dataPipe: 60, mobile: 73 },
          { week: 'W51', apiGw: 80, webDash: 69, auth: 90, dataPipe: 62, mobile: 75 },
          { week: 'W52', apiGw: 82, webDash: 71, auth: 91, dataPipe: 64, mobile: 77 },
        ],
      });
    }
    return Promise.reject(new Error('Unknown path'));
  }),
}));

import { registerProjectResources } from '../../resources/projects.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerProjectResources', () => {
  let server: InstanceType<typeof McpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerProjectResources(server);
  });

  // ── Registration ─────────────────────────────────────────────────────

  describe('registration', () => {
    it('registers exactly 3 resources', () => {
      expect(mockResource).toHaveBeenCalledTimes(3);
    });

    it('registers "projects-list" resource', () => {
      const names = mockResource.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('projects-list');
    });

    it('registers "projects-comparison" resource', () => {
      const names = mockResource.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('projects-comparison');
    });

    it('registers "projects-timeline" resource', () => {
      const names = mockResource.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('projects-timeline');
    });

    it('all resource names are unique', () => {
      const names = mockResource.mock.calls.map((c: unknown[]) => c[0]);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  // ── URI patterns ────────────────────────────────────────────────────

  describe('URI patterns', () => {
    it('projects-list uses recurrsive://projects/list URI', () => {
      const call = mockResource.mock.calls.find((c: unknown[]) => c[0] === 'projects-list');
      expect(call![1]).toBe('recurrsive://projects/list');
    });

    it('projects-comparison uses recurrsive://projects/comparison URI', () => {
      const call = mockResource.mock.calls.find((c: unknown[]) => c[0] === 'projects-comparison');
      expect(call![1]).toBe('recurrsive://projects/comparison');
    });

    it('projects-timeline uses recurrsive://projects/timeline URI', () => {
      const call = mockResource.mock.calls.find((c: unknown[]) => c[0] === 'projects-timeline');
      expect(call![1]).toBe('recurrsive://projects/timeline');
    });

    it('all URIs use recurrsive:// scheme', () => {
      for (const call of mockResource.mock.calls) {
        expect(call[1]).toMatch(/^recurrsive:\/\//);
      }
    });
  });

  // ── Resource metadata ──────────────────────────────────────────────

  describe('resource metadata', () => {
    it('each resource has metadata with description and mimeType', () => {
      for (const call of mockResource.mock.calls) {
        const meta = call[2] as { description: string; mimeType: string };
        expect(typeof meta.description).toBe('string');
        expect(meta.description.length).toBeGreaterThan(10);
        expect(meta.mimeType).toBe('text/markdown');
      }
    });
  });

  // ── Resource handlers ──────────────────────────────────────────────

  describe('resource handlers', () => {
    it('each resource has a handler function as last argument', () => {
      for (const call of mockResource.mock.calls) {
        const lastArg = call[call.length - 1];
        expect(typeof lastArg).toBe('function');
      }
    });
  });

  // ── projects-list handler ──────────────────────────────────────────

  describe('projects-list handler', () => {
    function getHandler(): (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
      const call = mockResource.mock.calls.find((c: unknown[]) => c[0] === 'projects-list');
      return call![call!.length - 1] as (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;
    }

    it('returns contents array', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/list' });
      expect(result).toHaveProperty('contents');
      expect(Array.isArray(result.contents)).toBe(true);
      expect(result.contents).toHaveLength(1);
    });

    it('includes URI and mimeType in response', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/list' });
      expect(result.contents[0].uri).toBe('recurrsive://projects/list');
      expect(result.contents[0].mimeType).toBe('text/markdown');
    });

    it('contains project overview header', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/list' });
      expect(result.contents[0].text).toContain('Projects Overview');
    });

    it('contains project table rows', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/list' });
      expect(result.contents[0].text).toContain('api-gateway');
      expect(result.contents[0].text).toContain('web-dashboard');
      expect(result.contents[0].text).toContain('auth-service');
    });

    it('contains total projects count', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/list' });
      expect(result.contents[0].text).toContain('Total Projects');
    });

    it('contains average health score', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/list' });
      expect(result.contents[0].text).toContain('Average Health');
    });
  });

  // ── projects-comparison handler ────────────────────────────────────

  describe('projects-comparison handler', () => {
    function getHandler(): (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
      const call = mockResource.mock.calls.find((c: unknown[]) => c[0] === 'projects-comparison');
      return call![call!.length - 1] as (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;
    }

    it('returns contents array', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/comparison' });
      expect(result.contents).toHaveLength(1);
    });

    it('contains comparison table header', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/comparison' });
      expect(result.contents[0].text).toContain('Cross-Project Health Comparison');
    });

    it('contains dimension columns', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/comparison' });
      expect(result.contents[0].text).toContain('Architecture');
      expect(result.contents[0].text).toContain('Security');
      expect(result.contents[0].text).toContain('Testing');
      expect(result.contents[0].text).toContain('Reliability');
    });

    it('mentions analyze_project tool', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/comparison' });
      expect(result.contents[0].text).toContain('analyze_project');
    });
  });

  // ── projects-timeline handler ──────────────────────────────────────

  describe('projects-timeline handler', () => {
    function getHandler(): (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
      const call = mockResource.mock.calls.find((c: unknown[]) => c[0] === 'projects-timeline');
      return call![call!.length - 1] as (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;
    }

    it('returns contents array', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/timeline' });
      expect(result.contents).toHaveLength(1);
    });

    it('contains evolution timeline header', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/timeline' });
      expect(result.contents[0].text).toContain('Project Evolution Timeline');
    });

    it('contains weekly data rows', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/timeline' });
      expect(result.contents[0].text).toContain('W49');
      expect(result.contents[0].text).toContain('W50');
      expect(result.contents[0].text).toContain('W51');
      expect(result.contents[0].text).toContain('W52');
    });

    it('mentions positive health trends', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://projects/timeline' });
      expect(result.contents[0].text).toContain('positive health trends');
    });
  });
});
