/** Evidence-grounded analysis assistant. */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { resolveAnalysis } from '../project-analysis.js';

interface AssistantBody {
  question: string;
}

function terms(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9_]+/).filter((term) => term.length > 2);
}

export async function registerAssistantRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: AssistantBody; Querystring: { projectId?: string } }>(
    '/api/v1/assistant/query',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['question'],
          properties: { question: { type: 'string', minLength: 2, maxLength: 2_000 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { cache } = await resolveAnalysis(request);
      if (!cache) {
        return reply.send({
          data: {
            answer: 'No analysis exists for the selected project yet. Run an analysis first, then I can search its findings and opportunities.',
            matches: [],
            grounded: true,
          },
        });
      }

      const queryTerms = terms(request.body.question);
      const candidates = [
        ...cache.findings.map((finding) => ({
          id: finding.id,
          kind: 'finding' as const,
          title: finding.title,
          severity: finding.severity,
          category: finding.category,
          description: finding.description,
          confidence: finding.confidence,
        })),
        ...cache.opportunities.map((opportunity) => ({
          id: opportunity.id,
          kind: 'opportunity' as const,
          title: opportunity.title,
          severity: opportunity.severity,
          category: opportunity.category,
          description: opportunity.recommendation,
          confidence: opportunity.confidence,
        })),
      ];

      const ranked = candidates
        .map((candidate) => {
          const haystack = `${candidate.title} ${candidate.category} ${candidate.severity} ${candidate.description}`.toLowerCase();
          const score = queryTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
          return { ...candidate, score };
        })
        .filter((candidate) => queryTerms.length === 0 || candidate.score > 0)
        .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
        .slice(0, 5);

      const severityCounts = cache.findings.reduce<Record<string, number>>((counts, finding) => {
        counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
        return counts;
      }, {});

      const summary = `The latest analysis contains ${cache.findings.length} findings and ${cache.opportunities.length} opportunities` +
        ` (${severityCounts['critical'] ?? 0} critical, ${severityCounts['high'] ?? 0} high).`;
      const answer = ranked.length > 0
        ? `${summary}\n\nMost relevant evidence:\n${ranked.map((item, index) =>
          `${index + 1}. [${item.severity.toUpperCase()}] ${item.title} — ${item.description}`,
        ).join('\n')}`
        : `${summary}\n\nI could not find evidence matching those terms. Try a severity, category, analyzer topic, or exact finding title.`;

      return reply.send({
        data: {
          answer,
          matches: ranked.map(({ score: _score, ...candidate }) => candidate),
          grounded: true,
          analyzedAt: cache.analyzedAt,
        },
      });
    },
  );
}
