/**
 * Unit tests for the analyze tool registration module.
 *
 * Tests cover:
 * - registerAnalyzeTools registers exactly 5 tools
 * - Each tool has correct name, description, schema, and handler
 * - Handlers return proper MCP content structure
 * - Handlers return guidance when server is not initialized
 * - Error paths produce isError responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTool = vi.fn();
const mockResource = vi.fn();
const mockPrompt = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: mockTool,
    resource: mockResource,
    prompt: mockPrompt,
  })),
}));

vi.mock('../../state.js', () => ({
  state: {
    isInitialized: vi.fn().mockReturnValue(false),
    getProjectPath: vi.fn().mockReturnValue('/test'),
    getGraph: vi.fn(),
    getOpportunities: vi.fn(),
    getProjectInfo: vi.fn(),
    getAnalysisCache: vi.fn().mockReturnValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    runAnalysis: vi.fn(),
  },
}));

vi.mock('@recurrsive/core', () => ({
  OpportunityCategorySchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  SeveritySchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  OpportunityStatusSchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  EntityTypeSchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  SEVERITY_WEIGHTS: { critical: 5, high: 4, medium: 3, low: 2, info: 1 },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  nowISO: vi.fn(() => '2024-01-01T00:00:00Z'),
  generateId: vi.fn(() => 'test-id'),
}));

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn(),
}));

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    getTopN: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('@recurrsive/policy', () => ({
  PolicyEngine: vi.fn(),
  BUILTIN_POLICIES: [],
}));

vi.mock('@recurrsive/analyzers', () => ({
  AnalyzerRegistry: vi.fn(),
  AnalyzerRunner: vi.fn(),
  createDefaultAnalyzers: vi.fn().mockReturnValue([]),
}));

vi.mock('@recurrsive/reasoning', () => ({
  ReasoningEngine: vi.fn(),
}));

vi.mock('@recurrsive/collectors', () => ({
  GitCollector: vi.fn(),
}));

vi.mock('zod', () => {
  const mockSchema: Record<string, unknown> = {};
  const chainable = (): Record<string, unknown> => mockSchema;
  mockSchema.describe = vi.fn().mockImplementation(chainable);
  mockSchema.optional = vi.fn().mockImplementation(chainable);
  mockSchema.url = vi.fn().mockImplementation(chainable);
  mockSchema.min = vi.fn().mockImplementation(chainable);
  return {
    z: {
      string: vi.fn().mockReturnValue(mockSchema),
      boolean: vi.fn().mockReturnValue(mockSchema),
      number: vi.fn().mockReturnValue(mockSchema),
      array: vi.fn().mockReturnValue(mockSchema),
      enum: vi.fn().mockReturnValue(mockSchema),
      unknown: vi.fn().mockReturnValue(mockSchema),
      object: vi.fn().mockReturnValue(mockSchema),
      record: vi.fn().mockReturnValue(mockSchema),
    },
  };
});

import { registerAnalyzeTools } from '../../tools/analyze.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerAnalyzeTools', () => {
  let server: InstanceType<typeof McpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAnalyzeTools(server);
  });

  // ── Registration ─────────────────────────────────────────────────────

  describe('registration', () => {
    it('registers exactly 5 tools', () => {
      expect(mockTool).toHaveBeenCalledTimes(5);
    });

    it('registers analyze_project tool', () => {
      const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('analyze_project');
    });

    it('registers get_opportunities tool', () => {
      const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('get_opportunities');
    });

    it('registers get_opportunity_detail tool', () => {
      const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('get_opportunity_detail');
    });

    it('registers query_graph tool', () => {
      const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('query_graph');
    });

    it('registers get_health_score tool', () => {
      const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('get_health_score');
    });
  });

  // ── Tool structure ──────────────────────────────────────────────────

  describe('tool structure', () => {
    it('each tool has a non-empty description', () => {
      for (const call of mockTool.mock.calls) {
        expect(typeof call[1]).toBe('string');
        expect((call[1] as string).length).toBeGreaterThan(10);
      }
    });

    it('each tool has a schema object', () => {
      for (const call of mockTool.mock.calls) {
        expect(typeof call[2]).toBe('object');
      }
    });

    it('each tool has a handler function as last arg', () => {
      for (const call of mockTool.mock.calls) {
        const lastArg = call[call.length - 1];
        expect(typeof lastArg).toBe('function');
      }
    });
  });

  // ── Handler behavior: uninitialized ──────────────────────────────────

  describe('handler behavior when not initialized', () => {
    function getHandler(toolName: string): (...args: unknown[]) => Promise<unknown> {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === toolName);
      return call![call!.length - 1] as (...args: unknown[]) => Promise<unknown>;
    }

    it('get_opportunities returns guidance when not initialized', async () => {
      const handler = getHandler('get_opportunities');
      const result = await handler({}) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('get_opportunity_detail returns guidance when not initialized', async () => {
      const handler = getHandler('get_opportunity_detail');
      const result = await handler({ id: 'test-id' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('query_graph returns guidance when not initialized', async () => {
      const handler = getHandler('query_graph');
      const result = await handler({ query: 'test' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('get_health_score returns guidance when not initialized', async () => {
      const handler = getHandler('get_health_score');
      const result = await handler({}) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });
  });

  // ── Handler behavior: MCP content format ────────────────────────────

  describe('handler return format', () => {
    function getHandler(toolName: string): (...args: unknown[]) => Promise<unknown> {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === toolName);
      return call![call!.length - 1] as (...args: unknown[]) => Promise<unknown>;
    }

    it('returns { content: [{ type: "text", text }] } shape', async () => {
      const handler = getHandler('get_opportunities');
      const result = await handler({}) as { content: Array<{ type: string; text: string }> };
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });
  });

  // ── analyze_project error handling ──────────────────────────────────

  describe('analyze_project error handling', () => {
    it('returns isError when analysis throws', async () => {
      const { state } = await import('../../state.js');
      vi.mocked(state.isInitialized).mockReturnValue(false);
      vi.mocked(state.initialize).mockRejectedValue(new Error('init failed'));

      const handler = mockTool.mock.calls.find(
        (c: unknown[]) => c[0] === 'analyze_project',
      )![mockTool.mock.calls.find((c: unknown[]) => c[0] === 'analyze_project')!.length - 1] as (
        args: unknown,
      ) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

      const result = await handler({ path: '/bad/path' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/failed/i);
    });
  });
});
