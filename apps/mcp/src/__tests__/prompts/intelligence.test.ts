/**
 * Unit tests for the intelligence prompt registration module.
 *
 * Tests cover:
 * - registerIntelligencePrompts registers exactly 3 prompts
 * - Each prompt has correct name, description, args, and handler
 * - forecast_health generates content per horizon
 * - simulation_review requires no args and returns proper messages
 * - confidence_analysis uses lookback count
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

import { registerIntelligencePrompts } from '../../prompts/intelligence.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerIntelligencePrompts', () => {
  let server: InstanceType<typeof McpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerIntelligencePrompts(server);
  });

  // ── Registration ─────────────────────────────────────────────────────

  describe('registration', () => {
    it('registers exactly 3 prompts', () => {
      expect(mockPrompt).toHaveBeenCalledTimes(3);
    });

    it('registers "forecast_health" prompt', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('forecast_health');
    });

    it('registers "simulation_review" prompt', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('simulation_review');
    });

    it('registers "confidence_analysis" prompt', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(names).toContain('confidence_analysis');
    });

    it('all prompt names are unique', () => {
      const names = mockPrompt.mock.calls.map((c: unknown[]) => c[0]);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  // ── Prompt structure ────────────────────────────────────────────────

  describe('prompt structure', () => {
    it('each prompt has a non-empty description', () => {
      for (const call of mockPrompt.mock.calls) {
        expect(typeof call[1]).toBe('string');
        expect((call[1] as string).length).toBeGreaterThan(10);
      }
    });

    it('each prompt has a handler function as the last argument', () => {
      for (const call of mockPrompt.mock.calls) {
        const lastArg = call[call.length - 1];
        expect(typeof lastArg).toBe('function');
      }
    });
  });

  // ── forecast_health handler ────────────────────────────────────────

  describe('forecast_health handler', () => {
    function getHandler(): (args: { horizon: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'forecast_health');
      return call![call!.length - 1] as (args: { horizon: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }>;
    }

    it('returns messages array with user role', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'week' });
      expect(result).toHaveProperty('messages');
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].role).toBe('user');
    });

    it('week horizon mentions one week', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'week' });
      expect(result.messages[0].content.text).toContain('one week');
    });

    it('month horizon mentions one month', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'month' });
      expect(result.messages[0].content.text).toContain('one month');
    });

    it('quarter horizon mentions quarter', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'quarter' });
      expect(result.messages[0].content.text).toContain('quarter');
    });

    it('includes baseline and trend sections', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'week' });
      expect(result.messages[0].content.text).toContain('Current Baseline');
      expect(result.messages[0].content.text).toContain('Trend Extrapolation');
    });

    it('includes risk factors section', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'week' });
      expect(result.messages[0].content.text).toContain('Risk Factors');
    });

    it('includes forecast summary section', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'week' });
      expect(result.messages[0].content.text).toContain('Forecast Summary');
    });

    it('mentions data-gathering tools', async () => {
      const handler = getHandler();
      const result = await handler({ horizon: 'month' });
      expect(result.messages[0].content.text).toContain('get_health_score');
      expect(result.messages[0].content.text).toContain('get_opportunities');
    });
  });

  // ── simulation_review handler ──────────────────────────────────────

  describe('simulation_review handler', () => {
    function getHandler(): (args: Record<string, never>) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'simulation_review');
      return call![call!.length - 1] as (args: Record<string, never>) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }>;
    }

    it('returns messages array', async () => {
      const handler = getHandler();
      const result = await handler({} as Record<string, never>);
      expect(result).toHaveProperty('messages');
      expect(result.messages).toHaveLength(1);
    });

    it('message has user role', async () => {
      const handler = getHandler();
      const result = await handler({} as Record<string, never>);
      expect(result.messages[0].role).toBe('user');
    });

    it('includes scenario summary section', async () => {
      const handler = getHandler();
      const result = await handler({} as Record<string, never>);
      expect(result.messages[0].content.text).toContain('Scenario Summary');
    });

    it('includes outcome comparison section', async () => {
      const handler = getHandler();
      const result = await handler({} as Record<string, never>);
      expect(result.messages[0].content.text).toContain('Outcome Comparison');
    });

    it('includes recommended actions section', async () => {
      const handler = getHandler();
      const result = await handler({} as Record<string, never>);
      expect(result.messages[0].content.text).toContain('Recommended Actions');
    });

    it('mentions list_experiments tool', async () => {
      const handler = getHandler();
      const result = await handler({} as Record<string, never>);
      expect(result.messages[0].content.text).toContain('list_experiments');
    });
  });

  // ── confidence_analysis handler ────────────────────────────────────

  describe('confidence_analysis handler', () => {
    function getHandler(): (args: { lookback: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'confidence_analysis');
      return call![call!.length - 1] as (args: { lookback: string }) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }>;
    }

    it('returns messages array', async () => {
      const handler = getHandler();
      const result = await handler({ lookback: '10' });
      expect(result).toHaveProperty('messages');
      expect(result.messages).toHaveLength(1);
    });

    it('uses the lookback count in the message', async () => {
      const handler = getHandler();
      const result = await handler({ lookback: '20' });
      expect(result.messages[0].content.text).toContain('20');
    });

    it('defaults lookback to 10 for invalid input', async () => {
      const handler = getHandler();
      const result = await handler({ lookback: 'invalid' });
      expect(result.messages[0].content.text).toContain('10');
    });

    it('includes calibration overview section', async () => {
      const handler = getHandler();
      const result = await handler({ lookback: '10' });
      expect(result.messages[0].content.text).toContain('Calibration Overview');
    });

    it('includes accuracy metrics section', async () => {
      const handler = getHandler();
      const result = await handler({ lookback: '10' });
      expect(result.messages[0].content.text).toContain('Accuracy Metrics');
    });

    it('mentions data-gathering tools', async () => {
      const handler = getHandler();
      const result = await handler({ lookback: '10' });
      expect(result.messages[0].content.text).toContain('get_opportunities');
      expect(result.messages[0].content.text).toContain('compare_analyses');
    });
  });

  // ── Prompt descriptions ─────────────────────────────────────────────

  describe('prompt descriptions', () => {
    it('forecast_health description mentions forecast', () => {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'forecast_health');
      expect((call![1] as string).toLowerCase()).toContain('forecast');
    });

    it('simulation_review description mentions simulation', () => {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'simulation_review');
      expect((call![1] as string).toLowerCase()).toContain('simulation');
    });

    it('confidence_analysis description mentions confidence', () => {
      const call = mockPrompt.mock.calls.find((c: unknown[]) => c[0] === 'confidence_analysis');
      expect((call![1] as string).toLowerCase()).toContain('confidence');
    });
  });
});
