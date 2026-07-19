/**
 * @module @recurrsive/mcp/tools/analyze
 *
 * MCP tool definitions for Recurrsive analysis operations.
 *
 * Provides five tools:
 * - `analyze_project` — Run the full analysis pipeline on a project
 * - `get_opportunities` — List prioritized opportunities
 * - `get_opportunity_detail` — Deep dive into a single opportunity
 * - `query_graph` — Query the knowledge graph
 * - `get_health_score` — Get the system health score
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type {
  Opportunity,
  Entity,
  Relationship,
} from '@recurrsive/core';
import {
  OpportunityCategorySchema,
  SeveritySchema,
  OpportunityStatusSchema,
  EntityTypeSchema,
} from '@recurrsive/core';
import { state } from '../state.js';
import { computeHealthScore, computeMaturityScores } from '../health.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an opportunity into a compact summary string.
 *
 * @param opp - The opportunity to format.
 * @returns A multi-line text summary.
 */
function formatOpportunitySummary(opp: Opportunity): string {
  return [
    `## ${opp.title}`,
    `- **ID:** ${opp.id}`,
    `- **Type:** ${opp.type}`,
    `- **Category:** ${opp.category}`,
    `- **Severity:** ${opp.severity}`,
    `- **Confidence:** ${(opp.confidence * 100).toFixed(0)}%`,
    `- **Status:** ${opp.status}`,
    `- **Effort:** ${opp.effort.t_shirt}`,
    `- **Risk Level:** ${opp.risk.level}`,
    '',
    `**Problem:** ${opp.problem}`,
    '',
    `**Recommendation:** ${opp.recommendation}`,
    '',
    `**Expected Impact:** ${opp.expected_impact.summary}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all analysis tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerAnalyzeTools(server: McpServer): void {
  // ── analyze_project ────────────────────────────────────────────────────

  server.tool(
    'analyze_project',
    'Run a LOCAL, in-process Recurrsive analysis on a project directory on THIS ' +
    'machine (results live only in this MCP session\'s memory). Collects code ' +
    'entities, builds the knowledge graph, runs analyzers, and optionally runs ' +
    'multi-agent reasoning to generate opportunities. Its results are read by ' +
    'the local tools (get_opportunities, query_graph, list_findings, ' +
    'get_health_score). To analyze on the Recurrsive server instead (persisted, ' +
    'shared, project-scoped), use trigger_server_analysis.',
    {
      path: z.string().describe('Absolute path to the project directory to analyze'),
      analyzers: z
        .array(z.string())
        .optional()
        .describe('Optional list of analyzer IDs to run. Omit to run all analyzers.'),
      include_reasoning: z
        .boolean()
        .optional()
        .describe(
          'Whether to run the multi-agent reasoning engine after analysis. ' +
          'Requires RECURRSIVE_LLM_API_KEY env var. Defaults to false.',
        ),
    },
    async ({ path, analyzers, include_reasoning }) => {
      try {
        // Initialize if needed or if project changed
        if (!state.isInitialized() || state.getProjectPath() !== path) {
          await state.dispose();
          await state.initialize(path);
        }

        const cache = await state.runAnalysis(analyzers, include_reasoning ?? false);

        const summary = [
          `# Analysis Complete`,
          '',
          `**Project:** ${path}`,
          `**Duration:** ${(cache.durationMs / 1000).toFixed(1)}s`,
          `**Findings:** ${cache.findings.length}`,
          `**Opportunities:** ${cache.opportunities.length}`,
          `**Analyzed at:** ${cache.analyzedAt}`,
          '',
          '## Finding Summary by Category',
          '',
        ];

        // Group findings by category
        const findingsByCategory = new Map<string, number>();
        for (const finding of cache.findings) {
          const count = findingsByCategory.get(finding.category) ?? 0;
          findingsByCategory.set(finding.category, count + 1);
        }
        for (const [category, count] of findingsByCategory.entries()) {
          summary.push(`- **${category}:** ${count} findings`);
        }

        if (cache.opportunities.length > 0) {
          summary.push('', '## Top Opportunities', '');
          for (const opp of cache.opportunities.slice(0, 5)) {
            summary.push(`- [${opp.severity.toUpperCase()}] ${opp.title} (${opp.category})`);
          }
        } else if (!(include_reasoning ?? false)) {
          summary.push(
            '',
            '> Reasoning was not run (include_reasoning=false), so no opportunities ' +
            'were generated. Findings above are the raw analyzer output.',
          );
        }

        // Canonical health score is derived from findings (see health.ts),
        // so a no-reasoning run with real findings does not report a false 100.
        const health = computeHealthScore(cache.findings);
        summary.push('', `## Health Score: ${health}/100`, '');
        if (cache.findings.length === 0) {
          summary.push(
            '> No findings were produced. If this is unexpected, verify the path is a ' +
            'git repository with analyzable source.',
          );
        }

        return {
          content: [{ type: 'text' as const, text: summary.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Analysis failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_opportunities ──────────────────────────────────────────────────

  server.tool(
    'get_opportunities',
    'Get prioritized improvement opportunities from the most recent analysis. ' +
    'Opportunities are ranked by a composite score of severity, confidence, ' +
    'impact, effort, and risk.',
    {
      category: z
        .string()
        .optional()
        .describe(
          'Filter by category: architecture, performance, security, cost, ' +
          'ai_quality, reliability, ux, accessibility, privacy, compliance, ' +
          'developer_experience, product, data, documentation, infrastructure',
        ),
      severity: z
        .string()
        .optional()
        .describe('Filter by severity: critical, high, medium, low, info'),
      top_n: z
        .number()
        .optional()
        .describe('Maximum number of opportunities to return (default: 10)'),
      status: z
        .string()
        .optional()
        .describe(
          'Filter by status: proposed, accepted, rejected, in_progress, ' +
          'implemented, validated, archived',
        ),
    },
    async ({ category, severity, top_n, status }) => {
      try {
        if (!state.isInitialized()) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
            }],
          };
        }

        const manager = state.getOpportunities();

        // Build typed filters
        const filters: {
          category?: ReturnType<typeof OpportunityCategorySchema.parse>;
          severity?: ReturnType<typeof SeveritySchema.parse>;
          status?: ReturnType<typeof OpportunityStatusSchema.parse>;
        } = {};

        if (category !== undefined) {
          const parsed = OpportunityCategorySchema.safeParse(category);
          if (parsed.success) {
            filters.category = parsed.data;
          }
        }
        if (severity !== undefined) {
          const parsed = SeveritySchema.safeParse(severity);
          if (parsed.success) {
            filters.severity = parsed.data;
          }
        }
        if (status !== undefined) {
          const parsed = OpportunityStatusSchema.safeParse(status);
          if (parsed.success) {
            filters.status = parsed.data;
          }
        }

        const opportunities = manager.list(
          Object.keys(filters).length > 0 ? filters : undefined,
        );

        const limit = top_n ?? 10;
        const limited = opportunities.slice(0, limit);

        if (limited.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No opportunities match the specified filters.',
            }],
          };
        }

        const output = [
          `# Opportunities (${limited.length} of ${opportunities.length} total)`,
          '',
        ];

        for (const opp of limited) {
          output.push(formatOpportunitySummary(opp));
          output.push('', '---', '');
        }

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get opportunities: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_opportunity_detail ─────────────────────────────────────────────

  server.tool(
    'get_opportunity_detail',
    'Get the full detail of a specific opportunity including evidence, ' +
    'impact assessment, validation plan, and rollback plan.',
    {
      id: z.string().describe('UUID of the opportunity to retrieve'),
    },
    async ({ id }) => {
      try {
        if (!state.isInitialized()) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
            }],
          };
        }

        const opp = state.getOpportunities().get(id);
        if (!opp) {
          return {
            content: [{
              type: 'text' as const,
              text: `Opportunity not found: ${id}`,
            }],
            isError: true,
          };
        }

        const detail = [
          `# ${opp.title}`,
          '',
          `**ID:** ${opp.id}`,
          `**Type:** ${opp.type}`,
          `**Category:** ${opp.category}`,
          `**Severity:** ${opp.severity}`,
          `**Status:** ${opp.status}`,
          `**Confidence:** ${(opp.confidence * 100).toFixed(0)}%`,
          `**Created:** ${opp.created_at}`,
          `**Updated:** ${opp.updated_at}`,
          '',
          '## Problem',
          '',
          opp.problem,
          '',
          '## Recommendation',
          '',
          opp.recommendation,
          '',
          '## Evidence',
          '',
        ];

        for (const ev of opp.evidence) {
          detail.push(
            `### ${ev.type} evidence (confidence: ${(ev.confidence * 100).toFixed(0)}%)`,
            '',
            ev.description,
            '',
            `- **Source:** ${ev.source}`,
            `- **Collected:** ${ev.collected_at}`,
            `- **Related entities:** ${ev.entity_ids.join(', ') || 'none'}`,
            '',
          );
        }

        detail.push(
          '## Expected Impact',
          '',
          `**Summary:** ${opp.expected_impact.summary}`,
          '',
        );

        if (opp.expected_impact.metrics.length > 0) {
          detail.push('**Metrics:**', '');
          for (const m of opp.expected_impact.metrics) {
            const parts = [`- **${m.name}**`];
            if (m.current_value !== undefined) parts.push(`current: ${String(m.current_value)}`);
            if (m.expected_value !== undefined) parts.push(`expected: ${String(m.expected_value)}`);
            if (m.change_percent !== undefined) parts.push(`change: ${m.change_percent}%`);
            detail.push(parts.join(', '));
          }
          detail.push('');
        }

        if (opp.expected_impact.affected_services.length > 0) {
          detail.push(`**Affected Services:** ${opp.expected_impact.affected_services.join(', ')}`, '');
        }

        if (opp.expected_impact.business_value) {
          detail.push(`**Business Value:** ${opp.expected_impact.business_value}`, '');
        }

        detail.push(
          '## Effort Estimate',
          '',
          `- **T-shirt size:** ${opp.effort.t_shirt}`,
        );
        if (opp.effort.estimated_hours !== undefined) {
          detail.push(`- **Estimated hours:** ${opp.effort.estimated_hours}`);
        }
        if (opp.effort.estimated_days !== undefined) {
          detail.push(`- **Estimated days:** ${opp.effort.estimated_days}`);
        }
        if (opp.effort.skills_required.length > 0) {
          detail.push(`- **Skills required:** ${opp.effort.skills_required.join(', ')}`);
        }
        if (opp.effort.dependencies.length > 0) {
          detail.push(`- **Dependencies:** ${opp.effort.dependencies.join(', ')}`);
        }
        detail.push('');

        detail.push(
          '## Risk Assessment',
          '',
          `- **Level:** ${opp.risk.level}`,
          `- **Description:** ${opp.risk.description}`,
          '',
        );
        if (opp.risk.mitigations.length > 0) {
          detail.push('**Mitigations:**', '');
          for (const m of opp.risk.mitigations) {
            detail.push(`- ${m}`);
          }
          detail.push('');
        }

        detail.push(
          '## Validation Plan',
          '',
        );
        for (const step of opp.validation.steps) {
          detail.push(`- [${step.type}] ${step.description}${step.duration ? ` (${step.duration})` : ''}`);
        }
        detail.push('');
        if (opp.validation.success_criteria.length > 0) {
          detail.push('**Success Criteria:**', '');
          for (const c of opp.validation.success_criteria) {
            detail.push(`- ${c}`);
          }
          detail.push('');
        }

        detail.push(
          '## Rollback Plan',
          '',
          `- **Strategy:** ${opp.rollback.strategy}`,
        );
        if (opp.rollback.estimated_duration) {
          detail.push(`- **Estimated duration:** ${opp.rollback.estimated_duration}`);
        }
        if (opp.rollback.data_impact) {
          detail.push(`- **Data impact:** ${opp.rollback.data_impact}`);
        }
        detail.push('');
        if (opp.rollback.steps.length > 0) {
          detail.push('**Steps:**', '');
          for (const step of opp.rollback.steps) {
            detail.push(`1. ${step}`);
          }
          detail.push('');
        }

        // Source locations
        if (opp.locations.length > 0) {
          detail.push('## Source Locations', '');
          for (const loc of opp.locations) {
            const lineRange = loc.start_line
              ? `:${loc.start_line}${loc.end_line ? `-${loc.end_line}` : ''}`
              : '';
            detail.push(`- \`${loc.file}${lineRange}\``);
          }
          detail.push('');
        }

        // Related opportunities
        if (opp.related.length > 0) {
          detail.push(`## Related Opportunities`, '', `IDs: ${opp.related.join(', ')}`, '');
        }

        // Agent provenance
        detail.push(
          '## Agent Provenance',
          '',
          `- **Proposer:** ${opp.reasoning.proposer}`,
          `- **Supporters:** ${opp.reasoning.supporters.join(', ') || 'none'}`,
          `- **Consensus score:** ${(opp.reasoning.consensus_score * 100).toFixed(0)}%`,
          '',
        );
        if (opp.reasoning.dissenters.length > 0) {
          detail.push('**Dissenting opinions:**', '');
          for (const d of opp.reasoning.dissenters) {
            detail.push(`- **${d.agent_id}:** ${d.reason}`);
          }
          detail.push('');
        }

        return {
          content: [{ type: 'text' as const, text: detail.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get opportunity detail: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── query_graph ────────────────────────────────────────────────────────

  server.tool(
    'query_graph',
    'Query the Recurrsive knowledge graph. Supports entity type filters ' +
    '(e.g. "function", "agent", "endpoint") or natural language queries ' +
    'that are mapped to entity type + property filters.',
    {
      query: z
        .string()
        .describe(
          'Query string — either an entity type name (e.g. "function", "agent", "prompt") ' +
          'or a natural language query like "all endpoints that call external APIs"',
        ),
      entity_type: z
        .string()
        .optional()
        .describe('Optional explicit entity type filter'),
      limit: z
        .number()
        .optional()
        .describe('Maximum results to return (default: 20)'),
    },
    async ({ query, entity_type, limit }) => {
      try {
        if (!state.isInitialized()) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
            }],
          };
        }

        const graph = state.getGraph();
        const maxResults = limit ?? 20;

        // Try to interpret query as an entity type
        const entityTypeParse = EntityTypeSchema.safeParse(
          entity_type ?? query.toLowerCase().replace(/\s+/g, '_'),
        );

        let entities: Entity[] = [];
        let relationships: Relationship[] = [];

        if (entityTypeParse.success) {
          // Direct entity type query
          entities = await graph.getEntities(entityTypeParse.data);
          entities = entities.slice(0, maxResults);

          // Gather relationships for found entities
          const relSets = await Promise.all(
            entities.slice(0, 10).map((e) => graph.getRelationships(e.id, 'both')),
          );
          relationships = relSets.flat().slice(0, maxResults);
        } else {
          // Fallback: search across all entity types by name pattern
          const stats = await graph.getStats();
          const allTypes = Object.keys(stats.entityCountsByType);

          for (const typeStr of allTypes) {
            const typeParse = EntityTypeSchema.safeParse(typeStr);
            if (!typeParse.success) continue;

            const typeEntities = await graph.getEntities(typeParse.data);
            const matching = typeEntities.filter(
              (e) =>
                e.name.toLowerCase().includes(query.toLowerCase()) ||
                e.qualified_name.toLowerCase().includes(query.toLowerCase()) ||
                (e.description ?? '').toLowerCase().includes(query.toLowerCase()),
            );
            entities.push(...matching);

            if (entities.length >= maxResults) break;
          }

          entities = entities.slice(0, maxResults);
        }

        if (entities.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `No entities found matching query: "${query}"`,
            }],
          };
        }

        const output = [
          `# Graph Query Results`,
          '',
          `**Query:** ${query}`,
          `**Results:** ${entities.length} entities`,
          '',
        ];

        for (const entity of entities) {
          output.push(
            `## ${entity.name}`,
            '',
            `- **Type:** ${entity.type}`,
            `- **Qualified Name:** ${entity.qualified_name}`,
          );
          if (entity.description) {
            output.push(`- **Description:** ${entity.description}`);
          }
          if (entity.source_location?.file) {
            const loc = entity.source_location;
            const lineRange = loc.start_line
              ? `:${loc.start_line}${loc.end_line ? `-${loc.end_line}` : ''}`
              : '';
            output.push(`- **Location:** \`${loc.file}${lineRange}\``);
          }
          output.push(`- **Source:** ${entity.source}`);
          output.push(`- **Tags:** ${entity.tags.join(', ') || 'none'}`);
          output.push('');
        }

        if (relationships.length > 0) {
          output.push('## Relationships', '');
          for (const rel of relationships.slice(0, 20)) {
            output.push(
              `- \`${rel.source_id}\` —[**${rel.type}**]→ \`${rel.target_id}\`` +
              ` (confidence: ${(rel.confidence * 100).toFixed(0)}%)`,
            );
          }
          output.push('');
        }

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Graph query failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_health_score ───────────────────────────────────────────────────

  server.tool(
    'get_health_score',
    'Get the overall health score and per-dimension maturity assessment ' +
    'for the analyzed project. Returns a score from 0–100 with dimension ' +
    'breakdowns and top risks.',
    {},
    async () => {
      try {
        if (!state.isInitialized()) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
            }],
          };
        }

        const cache = state.getAnalysisCache();
        if (!cache) {
          return {
            content: [{
              type: 'text' as const,
              text: 'Not analyzed yet — no analysis results are cached. ' +
                'Run the "analyze_project" tool first.',
            }],
          };
        }

        const opportunities = state.getOpportunities().list();
        const stats = await state.getGraph().getStats();
        const health = computeHealthScore(cache.findings);
        const maturity = computeMaturityScores(cache.findings);

        const output = [
          `# Health Score: ${health}/100`,
          '',
          `**Project:** ${state.getProjectInfo().name}`,
          `**Total Entities:** ${stats.totalEntities}`,
          `**Total Relationships:** ${stats.totalRelationships}`,
          `**Open Opportunities:** ${opportunities.filter((o: Opportunity) => o.status === 'proposed' || o.status === 'accepted').length}`,
          `**Open Risks:** ${opportunities.filter((o: Opportunity) => o.type === 'risk' && o.status !== 'archived').length}`,
          '',
          '## Maturity by Dimension',
          '',
          '| Dimension | Score | Level | Issues | Top Risks |',
          '| --- | --- | --- | --- | --- |',
        ];

        for (const dim of maturity) {
          const risks = dim.topRisks.length > 0 ? dim.topRisks.join('; ') : '—';
          output.push(
            `| ${dim.dimension} | ${dim.score}/100 | ${dim.level} | ${dim.issueCount} | ${risks} |`,
          );
        }

        output.push('');

        // Top risks overall
        const topRisks = opportunities
          .filter((o: Opportunity) => o.type === 'risk' && o.status !== 'archived')
          .slice(0, 5);

        if (topRisks.length > 0) {
          output.push('## Top Risks', '');
          for (const risk of topRisks) {
            output.push(
              `- [**${risk.severity.toUpperCase()}**] ${risk.title} (${risk.category})`,
            );
          }
          output.push('');
        }

        // Graph composition summary
        output.push('## Knowledge Graph Composition', '');
        const sortedTypes = Object.entries(stats.entityCountsByType)
          .sort(([, a], [, b]) => b - a);
        for (const [entityType, count] of sortedTypes) {
          output.push(`- **${entityType}:** ${count}`);
        }
        output.push('');

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get health score: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
