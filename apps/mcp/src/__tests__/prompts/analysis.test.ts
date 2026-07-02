/**
 * Unit tests for the analysis prompt registration module.
 *
 * Tests cover:
 * - registerAnalysisPrompts registers exactly 3 prompts
 * - Each prompt has correct name, description, args, and handler
 * - Prompt handlers return valid MCP message structures
 * - deep_dive_finding generates investigation steps per finding type
 * - compare_snapshots generates comparison guidance per timeframe
 * - generate_action_items generates prioritized action lists per focus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrompt = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: vi.fn(),
    resource: vi.fn(),
    prompt: mockPrompt,
  })),
}));

vi.mock('zod', () => {
  const mockSchema: Record<string, unknown> = {};
  const chainable = (): Record<string, unknown> => mockSchema;
  mockSchema.describe = vi.fn().mockImplementation(chainable);
  mockSchema.optional = vi.fn().mockImplementation(chainable);
  return {
    z: {
      string: vi.fn().mockReturnValue(mockSchema),
      enum: vi.fn().mockReturnValue(mockSchema),
    },
  };
});

import { registerAnalysisPrompts } from '../../prompts/analysis.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerAnalysisPrompts', () => {
  let server: InstanceType<typeof McpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAnalysisPrompts(server);
  });

  // ── Registration ─────────────────────────────────────────────────────

  describe('registration', () => {
    it('registers exactly 3 prompts', () => {
      expect(mockPrompt).toHaveBeenCalledTimes(3);
    });

    it('registers "deep_dive_finding" prompt', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('deep_dive_finding');
    });

    it('registers "compare_snapshots" prompt', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('compare_snapshots');
    });

    it('registers "generate_action_items" prompt', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('generate_action_items');
    });

    it('all prompt names are unique', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  // ── Prompt structure ────────────────────────────────────────────────

  describe('prompt structure', () => {
    it('each prompt has a non-empty description string', () => {
      for (const call of mockPrompt.mock.calls) {
        expect(typeof call[1]).toBe('string');
        expect((call[1] as string).length).toBeGreaterThan(10);
      }
    });

    it('each prompt has an args/schema object', () => {
      for (const call of mockPrompt.mock.calls) {
        // Args object is the third argument
        expect(typeof call[2]).toBe('object');
      }
    });

    it('each prompt has a handler function as last argument', () => {
      for (const call of mockPrompt.mock.calls) {
        const lastArg = call[call.length - 1];
        expect(typeof lastArg).toBe('function');
      }
    });
  });

  // ── deep_dive_finding handler ───────────────────────────────────────

  describe('deep_dive_finding handler', () => {
    function getHandler(): (args: { finding_type: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'deep_dive_finding');
      return call![call!.length - 1] as (args: { finding_type: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }>;
    }

    it('returns messages array with user role', async () => {
      const handler = getHandler();
      const result = await handler({ finding_type: 'security' });
      expect(result).toHaveProperty('messages');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
    });

    it('returns text content type', async () => {
      const handler = getHandler();
      const result = await handler({ finding_type: 'security' });
      expect(result.messages[0].content.type).toBe('text');
    });

    it('security type includes threat assessment steps', async () => {
      const handler = getHandler();
      const result = await handler({ finding_type: 'security' });
      expect(result.messages[0].content.text).toContain('security');
      expect(result.messages[0].content.text).toContain('Threat Assessment');
    });

    it('performance type includes profiling steps', async () => {
      const handler = getHandler();
      const result = await handler({ finding_type: 'performance' });
      expect(result.messages[0].content.text).toContain('performance');
      expect(result.messages[0].content.text).toContain('Profiling');
    });

    it('architecture type includes dependency mapping', async () => {
      const handler = getHandler();
      const result = await handler({ finding_type: 'architecture' });
      expect(result.messages[0].content.text).toContain('architecture');
      expect(result.messages[0].content.text).toContain('Dependency Mapping');
    });

    it('reliability type includes failure mode analysis', async () => {
      const handler = getHandler();
      const result = await handler({ finding_type: 'reliability' });
      expect(result.messages[0].content.text).toContain('reliability');
      expect(result.messages[0].content.text).toContain('Failure Mode');
    });

    it('mentions tool references for data gathering', async () => {
      const handler = getHandler();
      const result = await handler({ finding_type: 'security' });
      expect(result.messages[0].content.text).toContain('list_findings');
      expect(result.messages[0].content.text).toContain('get_entity');
    });
  });

  // ── compare_snapshots handler ───────────────────────────────────────

  describe('compare_snapshots handler', () => {
    function getHandler(): (args: { timeframe: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'compare_snapshots');
      return call![call!.length - 1] as (args: { timeframe: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }>;
    }

    it('returns messages array for week timeframe', async () => {
      const handler = getHandler();
      const result = await handler({ timeframe: 'week' });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('one week');
    });

    it('returns messages array for month timeframe', async () => {
      const handler = getHandler();
      const result = await handler({ timeframe: 'month' });
      expect(result.messages[0].content.text).toContain('one month');
    });

    it('returns messages array for quarter timeframe', async () => {
      const handler = getHandler();
      const result = await handler({ timeframe: 'quarter' });
      expect(result.messages[0].content.text).toContain('quarter');
    });

    it('mentions comparison tools', async () => {
      const handler = getHandler();
      const result = await handler({ timeframe: 'week' });
      expect(result.messages[0].content.text).toContain('compare_analyses');
    });

    it('includes snapshot selection section', async () => {
      const handler = getHandler();
      const result = await handler({ timeframe: 'week' });
      expect(result.messages[0].content.text).toContain('Snapshot Selection');
    });
  });

  // ── generate_action_items handler ───────────────────────────────────

  describe('generate_action_items handler', () => {
    function getHandler(): (args: { focus: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'generate_action_items');
      return call![call!.length - 1] as (args: { focus: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }>;
    }

    it('security focus mentions vulnerability remediation', async () => {
      const handler = getHandler();
      const result = await handler({ focus: 'security' });
      expect(result.messages[0].content.text).toContain('security');
      expect(result.messages[0].content.text).toContain('Vulnerability');
    });

    it('performance focus mentions optimization', async () => {
      const handler = getHandler();
      const result = await handler({ focus: 'performance' });
      expect(result.messages[0].content.text).toContain('performance');
    });

    it('all focus includes comprehensive items', async () => {
      const handler = getHandler();
      const result = await handler({ focus: 'all' });
      expect(result.messages[0].content.text).toContain('Comprehensive');
    });

    it('includes prioritization framework', async () => {
      const handler = getHandler();
      const result = await handler({ focus: 'all' });
      expect(result.messages[0].content.text).toContain('Quick Wins');
      expect(result.messages[0].content.text).toContain('Strategic');
    });

    it('mentions data-gathering tools', async () => {
      const handler = getHandler();
      const result = await handler({ focus: 'all' });
      expect(result.messages[0].content.text).toContain('get_opportunities');
      expect(result.messages[0].content.text).toContain('get_health_score');
    });
  });

  // ── Prompt descriptions ─────────────────────────────────────────────

  describe('prompt descriptions', () => {
    it('deep_dive_finding description mentions finding', () => {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'deep_dive_finding');
      expect((call![1] as string).toLowerCase()).toContain('finding');
    });

    it('compare_snapshots description mentions snapshot', () => {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'compare_snapshots');
      expect((call![1] as string).toLowerCase()).toContain('snapshot');
    });

    it('generate_action_items description mentions action', () => {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'generate_action_items');
      expect((call![1] as string).toLowerCase()).toContain('action');
    });
  });
});
