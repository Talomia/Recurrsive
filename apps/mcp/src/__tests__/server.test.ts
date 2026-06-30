/**
 * Unit tests for the MCP server setup and registration.
 *
 * Tests cover:
 * - Server has correct name and version
 * - All 18 tools are registered
 * - All 6 resources are registered
 * - All 9 prompts are registered
 * - Tools have valid schemas (verified by spy call args)
 * - createServer returns a valid McpServer instance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the MCP SDK and all registration modules
// ---------------------------------------------------------------------------

const mockTool = vi.fn();
const mockResource = vi.fn();
const mockPrompt = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation((config: Record<string, unknown>) => ({
    _config: config,
    tool: mockTool,
    resource: mockResource,
    prompt: mockPrompt,
    connect: mockConnect,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

// Mock the state module
vi.mock('../state.js', () => ({
  state: {
    dispose: vi.fn().mockResolvedValue(undefined),
  },
}));

// We do NOT mock the registration modules — they are imported normally
// so we can verify the actual registrations. But we need to mock their
// deep dependencies.

vi.mock('@recurrsive/core', () => ({
  OpportunityCategorySchema: { safeParse: vi.fn() },
  SeveritySchema: { safeParse: vi.fn() },
  OpportunityStatusSchema: { safeParse: vi.fn() },
  EntityTypeSchema: { safeParse: vi.fn() },
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
    },
  };
});

import { createServer, startServer } from '../server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Server Factory ─────────────────────────────────────────────────────

  describe('createServer', () => {
    it('creates a McpServer with the correct name', () => {
      createServer();

      expect(McpServer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'recurrsive',
        }),
      );
    });

    it('creates a McpServer with version 0.1.0', () => {
      createServer();

      expect(McpServer).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '0.1.0',
        }),
      );
    });

    it('creates a McpServer with a description', () => {
      createServer();

      expect(McpServer).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Engineering Intelligence Platform'),
        }),
      );
    });

    it('returns a server object', () => {
      const server = createServer();
      expect(server).toBeDefined();
      expect(server).toHaveProperty('tool');
      expect(server).toHaveProperty('resource');
      expect(server).toHaveProperty('prompt');
    });
  });

  // ── Tool Registration ──────────────────────────────────────────────────

  describe('tool registration', () => {
    it('registers exactly 18 tools', () => {
      createServer();
      expect(mockTool).toHaveBeenCalledTimes(18);
    });

    it('registers "analyze_project" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('analyze_project');
    });

    it('registers "get_opportunities" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('get_opportunities');
    });

    it('registers "get_opportunity_detail" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('get_opportunity_detail');
    });

    it('registers "query_graph" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('query_graph');
    });

    it('registers "get_health_score" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('get_health_score');
    });

    it('registers "list_findings" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('list_findings');
    });

    it('registers "get_entity" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('get_entity');
    });

    it('registers "trace_dependency" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('trace_dependency');
    });

    it('registers "explain_entity" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('explain_entity');
    });

    it('registers "analyze_impact" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('analyze_impact');
    });

    it('registers "search_graph" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('search_graph');
    });

    it('registers "export_snapshot" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('export_snapshot');
    });

    it('registers "import_snapshot" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('import_snapshot');
    });

    it('registers "evaluate_policies" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('evaluate_policies');
    });

    it('registers "compare_analyses" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('compare_analyses');
    });

    it('registers "list_webhooks" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('list_webhooks');
    });

    it('registers "register_webhook" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('register_webhook');
    });

    it('registers "manage_webhook" tool', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(toolNames).toContain('manage_webhook');
    });

    it('all 18 tool names are unique', () => {
      createServer();
      const toolNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      const uniqueNames = new Set(toolNames);
      expect(uniqueNames.size).toBe(18);
    });

    it('each tool has a description string as second argument', () => {
      createServer();
      for (const call of mockTool.mock.calls) {
        expect(typeof call[1]).toBe('string');
        expect((call[1] as string).length).toBeGreaterThan(0);
      }
    });

    it('tool descriptions contain meaningful content (min 10 chars)', () => {
      createServer();
      for (const call of mockTool.mock.calls) {
        expect((call[1] as string).length).toBeGreaterThan(10);
      }
    });

    it('each tool has a schema object or empty object as third argument', () => {
      createServer();
      for (const call of mockTool.mock.calls) {
        expect(typeof call[2]).toBe('object');
      }
    });

    it('each tool has a handler function as the last argument', () => {
      createServer();
      for (const call of mockTool.mock.calls) {
        const lastArg = call[call.length - 1];
        expect(typeof lastArg).toBe('function');
      }
    });
  });

  // ── Resource Registration ──────────────────────────────────────────────

  describe('resource registration', () => {
    it('registers exactly 6 resources', () => {
      createServer();
      expect(mockResource).toHaveBeenCalledTimes(6);
    });

    it('registers "health-latest" resource', () => {
      createServer();
      const resourceNames = mockResource.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(resourceNames).toContain('health-latest');
    });

    it('registers "opportunities-top" resource', () => {
      createServer();
      const resourceNames = mockResource.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(resourceNames).toContain('opportunities-top');
    });

    it('registers "graph-summary" resource', () => {
      createServer();
      const resourceNames = mockResource.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(resourceNames).toContain('graph-summary');
    });

    it('registers "timeline-latest" resource', () => {
      createServer();
      const resourceNames = mockResource.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(resourceNames).toContain('timeline-latest');
    });

    it('each resource has a URI pattern as second argument', () => {
      createServer();
      for (const call of mockResource.mock.calls) {
        expect(typeof call[1]).toBe('string');
        expect(call[1]).toMatch(/^recurrsive:\/\//);
      }
    });

    it('resources use recurrsive:// URI scheme', () => {
      createServer();
      const uris = mockResource.mock.calls.map(
        (call: unknown[]) => call[1],
      );
      expect(uris).toContain('recurrsive://health/latest');
      expect(uris).toContain('recurrsive://opportunities/top');
      expect(uris).toContain('recurrsive://graph/summary');
      expect(uris).toContain('recurrsive://timeline/latest');
      expect(uris).toContain('recurrsive://policies/active');
      expect(uris).toContain('recurrsive://webhooks/status');
    });

    it('registers "policies-active" resource', () => {
      createServer();
      const resourceNames = mockResource.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(resourceNames).toContain('policies-active');
    });

    it('registers "webhooks-status" resource', () => {
      createServer();
      const resourceNames = mockResource.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(resourceNames).toContain('webhooks-status');
    });

    it('each resource has a handler function as the last argument', () => {
      createServer();
      for (const call of mockResource.mock.calls) {
        const lastArg = call[call.length - 1];
        expect(typeof lastArg).toBe('function');
      }
    });
  });

  // ── Prompt Registration ────────────────────────────────────────────────

  describe('prompt registration', () => {
    it('registers exactly 9 prompts', () => {
      createServer();
      expect(mockPrompt).toHaveBeenCalledTimes(9);
    });

    it('registers "interpret_health_report" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('interpret_health_report');
    });

    it('registers "plan_improvement_cycle" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('plan_improvement_cycle');
    });

    it('registers "explain_opportunity" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('explain_opportunity');
    });

    it('registers "architecture_review" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('architecture_review');
    });

    it('registers "security_assessment" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('security_assessment');
    });

    it('registers "cost_analysis" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('cost_analysis');
    });

    it('registers "policy_compliance_report" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('policy_compliance_report');
    });

    it('registers "snapshot_comparison" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('snapshot_comparison');
    });

    it('registers "risk_assessment" prompt', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(promptNames).toContain('risk_assessment');
    });

    it('all 9 prompt names are unique', () => {
      createServer();
      const promptNames = mockPrompt.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      const uniqueNames = new Set(promptNames);
      expect(uniqueNames.size).toBe(9);
    });

    it('each prompt has a description string', () => {
      createServer();
      for (const call of mockPrompt.mock.calls) {
        expect(typeof call[1]).toBe('string');
        expect((call[1] as string).length).toBeGreaterThan(0);
      }
    });

    it('each prompt has a handler function as the last argument', () => {
      createServer();
      for (const call of mockPrompt.mock.calls) {
        const lastArg = call[call.length - 1];
        expect(typeof lastArg).toBe('function');
      }
    });
  });

  // ── startServer ────────────────────────────────────────────────────────

  describe('startServer', () => {
    it('creates a server and connects to a transport', async () => {
      await startServer();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('connects with a StdioServerTransport instance', async () => {
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );
      await startServer();
      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});
