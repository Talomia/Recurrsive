/**
 * Unit tests for the governance tool registration module.
 *
 * Tests cover:
 * - registerGovernanceTools registers exactly 4 tools
 * - Each tool has correct name, description, schema, and handler
 * - Handlers return guidance when server is not initialized
 * - evaluate_policies and compare_analyses return proper structures
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
    getOpportunities: vi.fn().mockReturnValue({
      list: vi.fn().mockReturnValue([]),
    }),
    getAnalysisCache: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('@recurrsive/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
  nowISO: vi.fn(() => '2024-01-01T00:00:00Z'),
}));

vi.mock('@recurrsive/policy', () => ({
  PolicyEngine: vi.fn().mockImplementation(() => ({
    getPolicies: vi.fn().mockReturnValue([]),
    passes: vi.fn().mockReturnValue({
      passed: true,
      effectiveAction: 'allow',
      violations: [],
      warnings: [],
    }),
  })),
  BUILTIN_POLICIES: [],
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

import { registerGovernanceTools } from '../../tools/governance.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerGovernanceTools', () => {
  let server: InstanceType<typeof McpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerGovernanceTools(server);
  });

  // ── Registration ─────────────────────────────────────────────────────

  describe('registration', () => {
    const expectedTools = [
      'export_snapshot',
      'import_snapshot',
      'evaluate_policies',
      'compare_analyses',
    ];

    it('registers exactly 4 tools', () => {
      expect(mockTool).toHaveBeenCalledTimes(4);
    });

    for (const toolName of expectedTools) {
      it(`registers "${toolName}" tool`, () => {
        const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
        expect(names).toContain(toolName);
      });
    }

    it('all tool names are unique', () => {
      const names = mockTool.mock.calls.map((c: unknown[]) => c[0]);
      expect(new Set(names).size).toBe(names.length);
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

    it('each tool has a schema or empty object as third argument', () => {
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

    it('export_snapshot returns guidance when not initialized', async () => {
      const handler = getHandler('export_snapshot');
      const result = await handler({}) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('import_snapshot returns guidance when not initialized', async () => {
      const handler = getHandler('import_snapshot');
      const result = await handler({ snapshot_path: '/tmp/snap.json' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('evaluate_policies returns guidance when not initialized', async () => {
      const handler = getHandler('evaluate_policies');
      const result = await handler({}) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });

    it('compare_analyses returns guidance when not initialized', async () => {
      const handler = getHandler('compare_analyses');
      const result = await handler({}) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/analyze_project/);
    });
  });

  // ── Handler return format ───────────────────────────────────────────

  describe('handler return format', () => {
    function getHandler(toolName: string): (...args: unknown[]) => Promise<unknown> {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === toolName);
      return call![call!.length - 1] as (...args: unknown[]) => Promise<unknown>;
    }

    it('all handlers return { content: [...] } shape', async () => {
      for (const toolName of ['export_snapshot', 'import_snapshot', 'evaluate_policies', 'compare_analyses']) {
        const handler = getHandler(toolName);
        const args = toolName === 'import_snapshot' ? { snapshot_path: '/tmp/s.json' } : {};
        const result = await handler(args) as { content: Array<{ type: string }> };
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
      }
    });
  });

  // ── Tool descriptions ──────────────────────────────────────────────

  describe('tool descriptions', () => {
    it('export_snapshot description mentions snapshot', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'export_snapshot');
      expect((call![1] as string).toLowerCase()).toContain('snapshot');
    });

    it('import_snapshot description mentions import', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'import_snapshot');
      expect((call![1] as string).toLowerCase()).toContain('import');
    });

    it('evaluate_policies description mentions polic', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'evaluate_policies');
      expect((call![1] as string).toLowerCase()).toContain('polic');
    });

    it('compare_analyses description mentions compare', () => {
      const call = mockTool.mock.calls.find((c: unknown[]) => c[0] === 'compare_analyses');
      expect((call![1] as string).toLowerCase()).toContain('compare');
    });
  });
});
