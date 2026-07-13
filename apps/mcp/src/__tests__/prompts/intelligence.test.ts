import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrompt = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({ prompt: mockPrompt })),
}));

import { registerIntelligencePrompts } from '../../prompts/intelligence.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('registerIntelligencePrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerIntelligencePrompts(new McpServer({ name: 'test', version: '0.0.1' }));
  });

  it('registers only the evidence-bounded health projection prompt', () => {
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(mockPrompt.mock.calls[0]?.[0]).toBe('forecast_health');
  });

  it.each([
    ['week', '7 days'],
    ['month', '30 days'],
    ['quarter', '90 days'],
  ])('uses the requested %s horizon', async (horizon, expected) => {
    const handler = mockPrompt.mock.calls[0]?.at(-1) as (args: { horizon: string }) => Promise<{
      messages: Array<{ content: { text: string } }>;
    }>;
    const result = await handler({ horizon });
    expect(result.messages[0]?.content.text).toContain(expected);
  });

  it('forbids invented projections when history is insufficient', async () => {
    const handler = mockPrompt.mock.calls[0]?.at(-1) as (args: { horizon: string }) => Promise<{
      messages: Array<{ content: { text: string } }>;
    }>;
    const result = await handler({ horizon: 'month' });
    expect(result.messages[0]?.content.text).toContain('do not invent');
    expect(result.messages[0]?.content.text).toContain('linear projection');
  });
});
