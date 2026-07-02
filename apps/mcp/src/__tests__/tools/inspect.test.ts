/**
 * Unit tests for the inspect tool registration module.
 *
 * Tests cover:
 * - registerInspectTools registers the 5 graph inspection tools
 * - Each tool has correct name, description, schema, and handler
 * - Handlers return guidance when server is not initialized
 * - search_graph is also registered via this module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTool = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: mockTool,
    resource: vi.fn(),
    prompt: vi.fn(),
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
  },
}));

vi.mock('@recurrsive/core', () => ({
  SeveritySchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  SEVERITY_WEIGHTS: { critical: 5, high: 4, medium: 3, low: 2, info: 1 },
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
  nowISO: vi.fn(() => '2024-01-01T00:00:00Z'),
}));

vi.mock('@recurrsive/graph', () => ({
  findDependencyTree: vi.fn().mockReturnValue({ sql: '', params: [] }),
}));

vi.mock('zod', () => {
  const mockSchema: Record<string, unknown> = {};
  const chainable = (): Record<string, unknown> => mockSchema;
  mockSchema.describe = vi.fn().mockImplementation(chainable);
  mockSchema.optional = vi.fn().mockImplementation(chainable);
  mockSchema.min = vi.fn().mockImplementation(chainable);
  return {
    z: {
      string: vi.fn().mockReturnValue(mockSchema),
      boolean: vi.fn().mockReturnValue(mockSchema),
      number: vi.fn().mockReturnValue(mockSchema),
      array: vi.fn().mockReturnValue(mockSchema),
      enum: vi.fn().mockReturnValue(mockSchema),
      object: vi.fn().mockReturnValue(mockSchema),
    },
  };
});

import { registerInspectTools } from '../../tools/inspect.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerInspectTools', () => {
  let server: InstanceType<typeof McpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerInspectTools(server);
  });

  // ── Registration ─────────────────────────────────────────────────────

  describe('registration', () => {
    const expectedTools = [
      'list_findings',
      'get_entity',
      'trace_dependency',
      'explain_entity',
      'analyze_impact',
      'search_graph',
    ];

    it('registers exactly 6 tools', () => {
      expect(mockTool).toHaveBeenCalledTimes(6);
    });

    for (const toolName of expectedTools) {
      it(`registers "${toolName}" tool`, () => {
        const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
        expect(names).toContain(toolName);
      });
    }

    it('all registered tool names are unique', () => {
      const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  // ── Tool structure ──────────────────────────────────────────────────

  describe('tool structure', () => {
    it('each tool has a description string longer than 10 chars', () => {
      for (const call of mockTool.mock.calls) {
        expect(typeof call[1]).toBe('string');
        expect((call[1] as string).length).toBeGreaterThan(10);
      }
    });

    it('each tool has a schema object as third argument', () => {
      for (const call of mockTool.mock.calls) {
        expect(typeof call[2]).toBe('object');
      }
    });

    it('each tool has a handler function as last argument', () => {
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

    it('list_findings returns guidance when not initialized', async () => {
      const handler = getHandler('list_findings');
      const result = await handler({}) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('get_entity returns guidance when not initialized', async () => {
      const handler = getHandler('get_entity');
      const result = await handler({ entity_id: 'abc' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('trace_dependency returns guidance when not initialized', async () => {
      const handler = getHandler('trace_dependency');
      const result = await handler({ source_id: 'abc' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('explain_entity returns guidance when not initialized', async () => {
      const handler = getHandler('explain_entity');
      const result = await handler({ entity_id: 'abc' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('analyze_impact returns guidance when not initialized', async () => {
      const handler = getHandler('analyze_impact');
      const result = await handler({ entity_id: 'abc' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });
  });

  // ── Handler return format ───────────────────────────────────────────

  describe('handler return format', () => {
    function getHandler(toolName: string): (...args: unknown[]) => Promise<unknown> {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === toolName);
      return call![call!.length - 1] as (...args: unknown[]) => Promise<unknown>;
    }

    it('list_findings returns MCP content array', async () => {
      const handler = getHandler('list_findings');
      const result = await handler({}) as { content: Array<{ type: string; text: string }> };
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('get_entity returns MCP content array', async () => {
      const handler = getHandler('get_entity');
      const result = await handler({ entity_id: 'x' }) as { content: Array<{ type: string; text: string }> };
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });

  // ── Specific tool descriptions ──────────────────────────────────────

  describe('tool descriptions', () => {
    it('list_findings description mentions findings', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'list_findings');
      expect((call![1] as string).toLowerCase()).toContain('finding');
    });

    it('get_entity description mentions entity', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'get_entity');
      expect((call![1] as string).toLowerCase()).toContain('entity');
    });

    it('trace_dependency description mentions dependency', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'trace_dependency');
      expect((call![1] as string).toLowerCase()).toContain('dependency');
    });

    it('analyze_impact description mentions impact', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'analyze_impact');
      expect((call![1] as string).toLowerCase()).toContain('impact');
    });

    it('search_graph description mentions search', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'search_graph');
      expect((call![1] as string).toLowerCase()).toContain('search');
    });
  });
});
