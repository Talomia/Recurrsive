/**
 * @module @recurrsive/server/routes/assistant
 *
 * AI assistant chat endpoint for the dashboard.
 *
 * Answers questions grounded in the project's real analysis: findings,
 * opportunities, and a graph summary. It uses the configured LLM provider
 * (the reasoning package's adapter). When no LLM key is configured it returns
 * an explicit `unavailable` state — it NEVER ships a canned/rotating fake reply.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '@recurrsive/core';
import { createLLMAdapter } from '@recurrsive/reasoning';
import type { LLMMessage } from '@recurrsive/reasoning';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeHealthScore, severityBreakdown } from '../health-score.js';

const logger = createLogger({ context: { component: 'server:routes:assistant' } });

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatBody {
  messages: ChatMessage[];
  projectId?: string;
}

/**
 * Build a grounding system prompt from the project's real analysis data.
 * Returns null when there is no analysis to ground the assistant in.
 */
async function buildGrounding(projectId?: string): Promise<string> {
  const cache = await state.loadCacheForProject(projectId);
  if (!cache) {
    return 'No analysis has been run for this project yet, so there are no findings, ' +
      'opportunities, or graph data to reference. Tell the user to run an analysis first ' +
      'and do not invent findings.';
  }

  const health = computeHealthScore(cache.findings, cache.opportunities);
  const severity = severityBreakdown(cache.findings);

  const topOpportunities = cache.opportunities
    .slice(0, 10)
    .map((o) => `- [${o.severity}] ${o.title} (${o.category}, status: ${o.status})`)
    .join('\n');

  const categoryCounts = new Map<string, number>();
  for (const f of cache.findings) {
    categoryCounts.set(f.category, (categoryCounts.get(f.category) ?? 0) + 1);
  }
  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `${cat}: ${n}`)
    .join(', ');

  return [
    'You are the Recurrsive engineering-intelligence assistant. Answer strictly from the',
    'analysis context below. If the answer is not supported by this data, say so — never fabricate.',
    '',
    `Overall health score: ${health.overall}/100`,
    `Total findings: ${cache.findings.length} (by severity: ${JSON.stringify(severity)})`,
    `Findings by category: ${categories || 'none'}`,
    `Opportunities: ${cache.opportunities.length}`,
    topOpportunities ? `Top opportunities:\n${topOpportunities}` : 'No opportunities recorded.',
    `Reasoning stage for the latest run: ${cache.reasoning.status}${cache.reasoning.reason ? ` (${cache.reasoning.reason})` : ''}.`,
  ].join('\n');
}

/**
 * Register the AI assistant route.
 *
 * @param app - Fastify instance.
 */
export async function registerAssistantRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/assistant/status
   *
   * Report assistant availability WITHOUT invoking the model — availability is
   * determined solely by whether an LLM key is configured. Lets clients show an
   * honest "online" / "set an LLM key" state on load with no token cost.
   */
  app.get('/api/v1/assistant/status', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const llmKey = process.env['RECURRSIVE_LLM_API_KEY'];
    const configured = Boolean(llmKey && llmKey.trim().length > 0);
    return reply.status(200).send({
      data: configured
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: 'no_llm_key',
            message: 'Configure RECURRSIVE_LLM_API_KEY to enable the assistant.',
          },
    });
  });

  /**
   * POST /api/v1/assistant/chat
   *
   * Body: `{ messages: [{ role, content }], projectId? }`.
   */
  app.post<{ Body: ChatBody }>('/api/v1/assistant/chat', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                content: { type: 'string' },
              },
            },
          },
          projectId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { messages, projectId } = request.body;

    const llmKey = process.env['RECURRSIVE_LLM_API_KEY'];
    if (!llmKey || llmKey.trim().length === 0) {
      return reply.status(200).send({
        data: {
          status: 'unavailable',
          reason: 'no_llm_key',
          message: 'Configure RECURRSIVE_LLM_API_KEY to enable the assistant.',
        },
      });
    }

    try {
      const adapter = createLLMAdapter({
        llm_provider: process.env['RECURRSIVE_LLM_PROVIDER'] ?? 'openai',
        llm_model: process.env['RECURRSIVE_LLM_MODEL'] ?? 'gpt-4.1-mini',
        llm_api_key: llmKey,
        max_debate_rounds: 1,
        min_consensus_score: 0.6,
        specialists: [],
        temperature: 0.2,
      });

      const grounding = await buildGrounding(projectId);
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: grounding },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await adapter.chat(llmMessages, { temperature: 0.2 });

      return reply.status(200).send({
        data: {
          status: 'ok',
          message: response.content,
          model: response.model,
          usage: response.usage,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Assistant chat failed: ${message}`);
      return reply.status(502).send({
        error: 'Assistant error',
        message: `The LLM provider request failed: ${message}`,
      });
    }
  });
}
