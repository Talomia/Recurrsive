/** Prompt for evidence-bounded interpretation of recorded health projections. */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerIntelligencePrompts(server: McpServer): void {
  server.prompt(
    'forecast_health',
    'Summarize the transparent linear health projection returned by Recurrsive.',
    {
      horizon: z.enum(['week', 'month', 'quarter']).describe('Projection horizon.'),
    },
    async ({ horizon }) => {
      const labels = { week: '7 days', month: '30 days', quarter: '90 days' } as const;
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Call \`forecast_health\` for a ${labels[horizon]} horizon.`,
              'Report only values returned by the tool: recorded history, fitted slope, R², projected values, and intervals.',
              'If the tool reports insufficient history, say so and do not invent a projection or scenario.',
              'Describe this as a linear projection of past health scores, not a causal prediction or commitment.',
            ].join('\n'),
          },
        }],
      };
    },
  );
}
