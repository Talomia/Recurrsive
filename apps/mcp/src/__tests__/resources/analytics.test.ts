/**
 * Unit tests for the analytics resource registration module.
 *
 * Tests cover:
 * - registerAnalyticsResources registers exactly 1 resource
 * - Resource has correct name, URI, metadata, and handler
 * - Handler returns valid MCP content with markdown analytics data
 * - Analytics summary contains health score trends, dimensions, and insights
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

import { registerAnalyticsResources } from '../../resources/analytics.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerAnalyticsResources', () => {
  let server: InstanceType<typeof McpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAnalyticsResources(server);
  });

  // ── Registration ─────────────────────────────────────────────────────

  describe('registration', () => {
    it('registers exactly 1 resource', () => {
      expect(mockResource).toHaveBeenCalledTimes(1);
    });

    it('registers "analytics-summary" resource', () => {
      const names = mockResource.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('analytics-summary');
    });
  });

  // ── URI pattern ─────────────────────────────────────────────────────

  describe('URI pattern', () => {
    it('uses recurrsive://analytics/summary URI', () => {
      expect(mockResource.mock.calls[0][1]).toBe('recurrsive://analytics/summary');
    });

    it('uses recurrsive:// scheme', () => {
      expect(mockResource.mock.calls[0][1]).toMatch(/^recurrsive:\/\//);
    });
  });

  // ── Resource metadata ──────────────────────────────────────────────

  describe('resource metadata', () => {
    it('has a description containing analytics/trends', () => {
      const meta = mockResource.mock.calls[0][2] as { description: string };
      expect(meta.description.toLowerCase()).toMatch(/trend|analytic/);
    });

    it('has text/markdown mimeType', () => {
      const meta = mockResource.mock.calls[0][2] as { mimeType: string };
      expect(meta.mimeType).toBe('text/markdown');
    });
  });

  // ── Handler function ───────────────────────────────────────────────

  describe('handler function', () => {
    it('has a handler function as last argument', () => {
      const lastArg = mockResource.mock.calls[0][mockResource.mock.calls[0].length - 1];
      expect(typeof lastArg).toBe('function');
    });
  });

  // ── analytics-summary handler ──────────────────────────────────────

  describe('analytics-summary handler', () => {
    function getHandler(): (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
      return mockResource.mock.calls[0][mockResource.mock.calls[0].length - 1] as (uri: { href: string }) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;
    }

    it('returns contents array with single entry', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result).toHaveProperty('contents');
      expect(result.contents).toHaveLength(1);
    });

    it('includes URI in response', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].uri).toBe('recurrsive://analytics/summary');
    });

    it('includes mimeType in response', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].mimeType).toBe('text/markdown');
    });

    it('contains Analytics Summary header', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Analytics Summary');
    });

    it('contains Current Health Score', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Current Health Score');
      expect(result.contents[0].text).toContain('/100');
    });

    it('contains Score Change over 5-week period', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Score Change');
      expect(result.contents[0].text).toContain('points');
    });

    it('contains health score trend table', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Health Score Trend');
      expect(result.contents[0].text).toContain('2024-W48');
      expect(result.contents[0].text).toContain('2024-W52');
    });

    it('contains dimension breakdown table', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Dimension Breakdown');
      expect(result.contents[0].text).toContain('Architecture');
      expect(result.contents[0].text).toContain('Security');
      expect(result.contents[0].text).toContain('Testing');
      expect(result.contents[0].text).toContain('Documentation');
    });

    it('contains key insights section', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Key Insights');
    });

    it('identifies documentation as lowest-scoring dimension', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Documentation remains the lowest');
    });

    it('identifies testing as strongest dimension', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Testing is the strongest');
    });

    it('contains open opportunities count', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Open Opportunities');
    });

    it('contains resolved count', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('Resolved');
    });

    it('mentions tool references for live data', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      expect(result.contents[0].text).toContain('get_health_score');
      expect(result.contents[0].text).toContain('get_opportunities');
    });

    it('health score trend shows positive improvement', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      // W48=62, W52=74 → delta = +12
      expect(result.contents[0].text).toContain('+12');
    });

    it('resolved count totals correctly', async () => {
      const handler = getHandler();
      const result = await handler({ href: 'recurrsive://analytics/summary' });
      // 4 + 6 + 5 + 7 + 4 = 26
      expect(result.contents[0].text).toContain('26');
    });
  });
});
