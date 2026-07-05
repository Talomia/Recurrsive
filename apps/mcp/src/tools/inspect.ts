/**
 * @module @recurrsive/mcp/tools/inspect
 *
 * MCP tool definitions for entity inspection and impact analysis.
 *
 * Provides five tools:
 * - `list_findings` — List analysis findings with optional severity filter
 * - `get_entity` — Get full entity details by ID from the knowledge graph
 * - `trace_dependency` — Trace dependency chain between entities
 * - `explain_entity` — LLM-powered entity explanation (requires reasoning config)
 * - `analyze_impact` — Analyze potential impact of changing an entity
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Finding, Entity, Relationship } from '@recurrsive/core';
import { SeveritySchema, SEVERITY_WEIGHTS } from '@recurrsive/core';
import { findDependencyTree } from '@recurrsive/graph';
import { state } from '../state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a finding into a compact summary string.
 *
 * @param finding - The finding to format.
 * @returns A multi-line text summary.
 */
function formatFindingSummary(finding: Finding): string {
  const lines = [
    `## ${finding.title}`,
    `- **ID:** ${finding.id}`,
    `- **Analyzer:** ${finding.analyzer_id}`,
    `- **Severity:** ${finding.severity}`,
    `- **Category:** ${finding.category}`,
    `- **Confidence:** ${(finding.confidence * 100).toFixed(0)}%`,
    `- **Created:** ${finding.created_at}`,
    '',
    finding.description,
  ];

  if (finding.suggested_fix) {
    lines.push('', `**Suggested Fix:** ${finding.suggested_fix}`);
  }

  if (finding.locations.length > 0) {
    lines.push('', '**Locations:**');
    for (const loc of finding.locations) {
      const lineRange = loc.start_line
        ? `:${loc.start_line}${loc.end_line ? `-${loc.end_line}` : ''}`
        : '';
      lines.push(`- \`${loc.file}${lineRange}\``);
    }
  }

  return lines.join('\n');
}

/**
 * Format an entity into a detailed markdown block.
 *
 * @param entity - The entity to format.
 * @returns Multi-line markdown string.
 */
function formatEntityDetail(entity: Entity): string {
  const lines = [
    `## ${entity.name}`,
    '',
    `- **ID:** ${entity.id}`,
    `- **Type:** ${entity.type}`,
    `- **Qualified Name:** ${entity.qualified_name}`,
  ];

  if (entity.description) {
    lines.push(`- **Description:** ${entity.description}`);
  }

  if (entity.source_location?.file) {
    const loc = entity.source_location;
    const lineRange = loc.start_line
      ? `:${loc.start_line}${loc.end_line ? `-${loc.end_line}` : ''}`
      : '';
    lines.push(`- **Location:** \`${loc.file}${lineRange}\``);
  }

  lines.push(
    `- **Source:** ${entity.source}`,
    `- **Tags:** ${entity.tags.join(', ') || 'none'}`,
  );

  // Show entity properties
  if (entity.properties && Object.keys(entity.properties).length > 0) {
    lines.push('', '### Properties', '');
    for (const [key, value] of Object.entries(entity.properties)) {
      lines.push(`- **${key}:** ${JSON.stringify(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a relationship into a compact string.
 *
 * @param rel - The relationship to format.
 * @returns Single-line markdown summary.
 */
function formatRelationship(rel: Relationship): string {
  return (
    `- \`${rel.source_id}\` —[**${rel.type}**]→ \`${rel.target_id}\`` +
    ` (confidence: ${(rel.confidence * 100).toFixed(0)}%)`
  );
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all inspect tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerInspectTools(server: McpServer): void {
  // ── list_findings ──────────────────────────────────────────────────────

  server.tool(
    'list_findings',
    'List analysis findings from the most recent analysis run. ' +
    'Findings are raw observations from analyzers, before reasoning ' +
    'promotes them into opportunities. Supports severity and category filters.',
    {
      severity: z
        .string()
        .optional()
        .describe('Filter by severity: critical, high, medium, low, info'),
      category: z
        .string()
        .optional()
        .describe(
          'Filter by category: architecture, performance, security, cost, ' +
          'ai_quality, reliability, ux, accessibility, privacy, compliance, ' +
          'developer_experience, product, data, documentation, infrastructure',
        ),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of findings to return (default: 20)'),
    },
    async ({ severity, category, limit }) => {
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
              text: 'No analysis results cached. Use the "analyze_project" tool first.',
            }],
          };
        }

        let findings = cache.findings;

        // Apply severity filter
        if (severity !== undefined) {
          const parsed = SeveritySchema.safeParse(severity);
          if (parsed.success) {
            findings = findings.filter((f) => f.severity === parsed.data);
          }
        }

        // Apply category filter
        if (category !== undefined) {
          findings = findings.filter((f) => f.category === category);
        }

        // Sort by severity weight (descending) then confidence (descending)
        findings.sort((a, b) => {
          const wA = SEVERITY_WEIGHTS[a.severity] ?? 0;
          const wB = SEVERITY_WEIGHTS[b.severity] ?? 0;
          if (wB !== wA) return wB - wA;
          return b.confidence - a.confidence;
        });

        const maxResults = limit ?? 20;
        const limited = findings.slice(0, maxResults);

        if (limited.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No findings match the specified filters.',
            }],
          };
        }

        const output = [
          `# Analysis Findings (${limited.length} of ${findings.length} total)`,
          '',
        ];

        for (const finding of limited) {
          output.push(formatFindingSummary(finding));
          output.push('', '---', '');
        }

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to list findings: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_entity ─────────────────────────────────────────────────────────

  server.tool(
    'get_entity',
    'Get the full details of a specific entity from the knowledge graph, ' +
    'including its properties, source location, and related entities ' +
    '(neighbors at depth 1).',
    {
      entity_id: z.string().describe('UUID of the entity to retrieve'),
    },
    async ({ entity_id }) => {
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
        const entity = await graph.getEntity(entity_id);

        if (!entity) {
          return {
            content: [{
              type: 'text' as const,
              text: `Entity not found: ${entity_id}`,
            }],
            isError: true,
          };
        }

        const output = [
          `# Entity: ${entity.name}`,
          '',
          formatEntityDetail(entity),
          '',
        ];

        // Fetch neighbors
        const neighbors = await graph.getNeighbors(entity_id, 1);
        const relatedEntities = neighbors.entities.filter((e) => e.id !== entity_id);

        if (relatedEntities.length > 0) {
          output.push('## Related Entities', '');
          for (const related of relatedEntities) {
            output.push(
              `- **${related.name}** (${related.type}) — \`${related.id}\``,
            );
          }
          output.push('');
        }

        if (neighbors.relationships.length > 0) {
          output.push('## Relationships', '');
          for (const rel of neighbors.relationships) {
            output.push(formatRelationship(rel));
          }
          output.push('');
        }

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get entity: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── trace_dependency ───────────────────────────────────────────────────

  server.tool(
    'trace_dependency',
    'Trace the dependency chain from a source entity, following depends_on, ' +
    'imports, and references edges. Optionally checks if a specific target ' +
    'entity is in the dependency tree.',
    {
      source_id: z.string().describe('UUID of the source entity to trace from'),
      target_id: z
        .string()
        .optional()
        .describe(
          'Optional UUID of a target entity. If provided, checks whether ' +
          'the target is in the dependency tree of the source.',
        ),
    },
    async ({ source_id, target_id }) => {
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

        // Verify the source entity exists
        const sourceEntity = await graph.getEntity(source_id);
        if (!sourceEntity) {
          return {
            content: [{
              type: 'text' as const,
              text: `Source entity not found: ${source_id}`,
            }],
            isError: true,
          };
        }

        // Execute the dependency tree query.
        // Dialect is 'sql' because the MCP server always uses the SQLite
        // backend (see state.ts:80-82). If AGE support is added to MCP,
        // this must be updated to detect the graph provider dynamically.
        const depQuery = findDependencyTree(source_id, 'sql');
        const rows = await graph.query(depQuery.sql, {
          '1': depQuery.params[0],
          '2': depQuery.params[1],
        });

        // Parse results — rows are entity-shaped records
        const depEntities: Array<{ id: string; name: string; type: string }> = [];
        for (const row of rows) {
          const r = row as Record<string, unknown>;
          if (r['id'] && r['name'] && r['type']) {
            depEntities.push({
              id: String(r['id']),
              name: String(r['name']),
              type: String(r['type']),
            });
          }
        }

        const output = [
          `# Dependency Trace`,
          '',
          `**Source:** ${sourceEntity.name} (\`${source_id}\`)`,
          `**Dependencies found:** ${depEntities.length}`,
          '',
        ];

        // Check target reachability
        if (target_id) {
          const targetEntity = await graph.getEntity(target_id);
          const targetName = targetEntity?.name ?? target_id;
          const found = depEntities.some((e) => e.id === target_id);

          output.push(
            `## Target Reachability`,
            '',
            `**Target:** ${targetName} (\`${target_id}\`)`,
            `**Reachable:** ${found ? '✅ Yes' : '❌ No'}`,
            '',
          );
        }

        // List dependency tree
        if (depEntities.length > 0) {
          output.push('## Dependency Tree', '');
          for (const dep of depEntities) {
            const isSelf = dep.id === source_id ? ' *(root)*' : '';
            output.push(`- **${dep.name}** (${dep.type}) — \`${dep.id}\`${isSelf}`);
          }
          output.push('');
        }

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Dependency trace failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── explain_entity ─────────────────────────────────────────────────────

  server.tool(
    'explain_entity',
    'Use the LLM to explain what an entity does based on its knowledge ' +
    'graph context. Builds a context prompt from the entity\'s properties, ' +
    'neighbors, and relationships, then calls the reasoning engine. ' +
    'NOTE: Requires RECURRSIVE_LLM_API_KEY environment variable to be set.',
    {
      entity_id: z.string().describe('UUID of the entity to explain'),
    },
    async ({ entity_id }) => {
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
        const entity = await graph.getEntity(entity_id);

        if (!entity) {
          return {
            content: [{
              type: 'text' as const,
              text: `Entity not found: ${entity_id}`,
            }],
            isError: true,
          };
        }

        // Gather context from neighbors
        const neighbors = await graph.getNeighbors(entity_id, 1);
        const relatedEntities = neighbors.entities.filter((e) => e.id !== entity_id);

        // Build context for LLM explanation
        const contextLines = [
          `Entity: ${entity.name}`,
          `Type: ${entity.type}`,
          `Qualified Name: ${entity.qualified_name}`,
        ];

        if (entity.description) {
          contextLines.push(`Description: ${entity.description}`);
        }

        if (entity.source_location?.file) {
          contextLines.push(`Location: ${entity.source_location.file}`);
        }

        if (entity.properties && Object.keys(entity.properties).length > 0) {
          contextLines.push(`Properties: ${JSON.stringify(entity.properties)}`);
        }

        if (relatedEntities.length > 0) {
          contextLines.push('', 'Related Entities:');
          for (const related of relatedEntities) {
            contextLines.push(`- ${related.name} (${related.type})`);
          }
        }

        if (neighbors.relationships.length > 0) {
          contextLines.push('', 'Relationships:');
          for (const rel of neighbors.relationships) {
            const direction = rel.source_id === entity_id ? 'outgoing' : 'incoming';
            const otherId = rel.source_id === entity_id ? rel.target_id : rel.source_id;
            const otherEntity = relatedEntities.find((e) => e.id === otherId);
            const otherName = otherEntity?.name ?? otherId;
            contextLines.push(`- [${direction}] ${rel.type} → ${otherName}`);
          }
        }

        // Check for LLM API key
        const apiKey = process.env['RECURRSIVE_LLM_API_KEY'];
        if (!apiKey) {
          // Return a structured context summary instead of LLM explanation
          const output = [
            `# Entity Explanation: ${entity.name}`,
            '',
            '> **Note:** LLM explanation unavailable — RECURRSIVE_LLM_API_KEY ' +
            'is not set. Providing structured context instead.',
            '',
            formatEntityDetail(entity),
            '',
          ];

          if (relatedEntities.length > 0) {
            output.push('## Graph Context', '');
            output.push(`This ${entity.type} entity has ${relatedEntities.length} ` +
              `direct connections in the knowledge graph:`, '');
            for (const rel of neighbors.relationships) {
              const direction = rel.source_id === entity_id ? 'outgoing' : 'incoming';
              const otherId = rel.source_id === entity_id ? rel.target_id : rel.source_id;
              const otherEntity2 = relatedEntities.find((e) => e.id === otherId);
              const otherName = otherEntity2?.name ?? otherId;
              output.push(`- **${direction}** \`${rel.type}\` → ${otherName}`);
            }
            output.push('');
          }

          return {
            content: [{ type: 'text' as const, text: output.join('\n') }],
          };
        }

        // Use the reasoning engine to generate an explanation
        const { ReasoningEngine } = await import('@recurrsive/reasoning');

        const reasoningConfig = {
          llm_provider: process.env['RECURRSIVE_LLM_PROVIDER'] ?? 'openai',
          llm_model: process.env['RECURRSIVE_LLM_MODEL'] ?? 'gpt-4.1-mini',
          llm_api_key: apiKey,
          max_debate_rounds: 1,
          min_consensus_score: 0.5,
          specialists: ['architecture_engineer' as const],
          temperature: 0.3,
        };

        const engine = new ReasoningEngine(reasoningConfig);

        // Create a synthetic finding to drive the explanation
        const locations: { file: string; start_line?: number; end_line?: number }[] = [];
        if (entity.source_location?.file) {
          locations.push({
            file: entity.source_location.file,
            start_line: entity.source_location.start_line,
            end_line: entity.source_location.end_line,
          });
        }

        const syntheticFinding: Finding = {
          id: crypto.randomUUID(),
          analyzer_id: 'mcp:explain_entity',
          title: `Explain: ${entity.name}`,
          description: [
            `Explain what this ${entity.type} entity does and its role in the system.`,
            '',
            'Context:',
            ...contextLines,
          ].join('\n'),
          severity: 'info',
          category: 'architecture',
          evidence: [],
          locations,
          confidence: 1.0,
          tags: ['explanation'],
          created_at: new Date().toISOString(),
        };

        const consensus = await engine.process([syntheticFinding], graph);

        const output = [
          `# Entity Explanation: ${entity.name}`,
          '',
          formatEntityDetail(entity),
          '',
        ];

        if (consensus.opportunities.length > 0) {
          output.push('## LLM Explanation', '');
          for (const opp of consensus.opportunities) {
            output.push(opp.problem);
            if (opp.recommendation) {
              output.push('', `**Recommendation:** ${opp.recommendation}`);
            }
          }
        } else {
          output.push(
            '## Context Summary',
            '',
            `This is a \`${entity.type}\` entity with ${relatedEntities.length} ` +
            `direct connections in the knowledge graph.`,
          );
        }

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to explain entity: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── analyze_impact ─────────────────────────────────────────────────────

  server.tool(
    'analyze_impact',
    'Analyze the potential impact of changing an entity by examining its ' +
    'reverse dependency tree (dependents). Estimates the blast radius and ' +
    'categorizes affected entities by type and severity.',
    {
      entity_id: z.string().describe('UUID of the entity to analyze impact for'),
    },
    async ({ entity_id }) => {
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
        const entity = await graph.getEntity(entity_id);

        if (!entity) {
          return {
            content: [{
              type: 'text' as const,
              text: `Entity not found: ${entity_id}`,
            }],
            isError: true,
          };
        }

        // Get reverse dependents — entities that depend on this one
        // Use a reverse dependency query (swap direction: target → source)
        const reverseDepsQuery = `
WITH RECURSIVE rev_tree(entity_id, depth, path) AS (
  SELECT ?, 0, ?
  UNION ALL
  SELECT r.source_id, rt.depth + 1, rt.path || ',' || r.source_id
  FROM rev_tree rt
  JOIN relationships r ON r.target_id = rt.entity_id
    AND r.type IN ('depends_on', 'imports', 'references', 'calls', 'uses_tool', 'uses_model')
  WHERE rt.depth < 20
    AND INSTR(rt.path, r.source_id) = 0
)
SELECT DISTINCT e.*
FROM rev_tree rt
JOIN entities e ON e.id = rt.entity_id
ORDER BY rt.depth;`.trim();

        const rows = await graph.query(reverseDepsQuery, {
          '1': entity_id,
          '2': entity_id,
        });

        // Parse dependent entities
        const dependents: Array<{ id: string; name: string; type: string }> = [];
        for (const row of rows) {
          const r = row as Record<string, unknown>;
          if (r['id'] && r['name'] && r['type'] && String(r['id']) !== entity_id) {
            dependents.push({
              id: String(r['id']),
              name: String(r['name']),
              type: String(r['type']),
            });
          }
        }

        // Get graph stats for blast radius calculation
        const stats = await graph.getStats();
        const totalEntities = stats.totalEntities || 1;
        const blastRadius = ((dependents.length / totalEntities) * 100).toFixed(1);

        // Group dependents by type
        const byType = new Map<string, number>();
        for (const dep of dependents) {
          const count = byType.get(dep.type) ?? 0;
          byType.set(dep.type, count + 1);
        }

        // Determine risk level
        let riskLevel: string;
        const ratio = dependents.length / totalEntities;
        if (ratio >= 0.3) riskLevel = '🔴 Critical';
        else if (ratio >= 0.15) riskLevel = '🟠 High';
        else if (ratio >= 0.05) riskLevel = '🟡 Medium';
        else if (dependents.length > 0) riskLevel = '🟢 Low';
        else riskLevel = '⚪ None';

        const output = [
          `# Impact Analysis: ${entity.name}`,
          '',
          `**Entity:** ${entity.name} (\`${entity.type}\`)`,
          `**ID:** ${entity_id}`,
          '',
          '## Blast Radius',
          '',
          `- **Affected entities:** ${dependents.length}`,
          `- **Blast radius:** ${blastRadius}% of graph`,
          `- **Risk level:** ${riskLevel}`,
          '',
        ];

        if (byType.size > 0) {
          output.push(
            '## Affected Entity Types',
            '',
            '| Type | Count |',
            '| --- | --- |',
          );
          const sortedTypes = [...byType.entries()].sort(([, a], [, b]) => b - a);
          for (const [type, count] of sortedTypes) {
            output.push(`| ${type} | ${count} |`);
          }
          output.push('');
        }

        // List specific dependents (capped at 30)
        if (dependents.length > 0) {
          const shown = dependents.slice(0, 30);
          output.push(
            `## Dependents (${shown.length}${dependents.length > 30 ? ` of ${dependents.length}` : ''})`,
            '',
          );
          for (const dep of shown) {
            output.push(`- **${dep.name}** (${dep.type}) — \`${dep.id}\``);
          }
          if (dependents.length > 30) {
            output.push('', `*... and ${dependents.length - 30} more*`);
          }
          output.push('');
        }

        // Recommendations based on blast radius
        output.push('## Recommendations', '');
        if (ratio >= 0.15) {
          output.push(
            '- ⚠️ **High coupling detected.** Changes to this entity have a wide blast radius.',
            '- Consider introducing an abstraction layer or interface to reduce direct coupling.',
            '- Use feature flags or staged rollouts when modifying this entity.',
            '- Ensure comprehensive test coverage of all dependents before making changes.',
          );
        } else if (dependents.length > 0) {
          output.push(
            '- Review the listed dependents to understand change propagation.',
            '- Add regression tests for dependent entities before modifying.',
            '- Consider notifying owners of dependent components.',
          );
        } else {
          output.push(
            '- This entity has no detected dependents — changes are low risk.',
            '- Consider if this entity might be dead code (no consumers).',
          );
        }
        output.push('');

        return {
          content: [{ type: 'text' as const, text: output.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Impact analysis failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── search_graph ─────────────────────────────────────────────────────

  server.tool(
    'search_graph',
    'Full-text search for entities in the knowledge graph. Uses FTS5 with Porter stemming for ranked results across entity names, qualified names, and descriptions. Faster and more relevant than pattern matching.',
    {
      query: z.string().describe(
        'Search query string. Supports natural language terms. Examples: "auth login", "database connection", "payment handler".',
      ),
      type: z
        .string()
        .optional()
        .describe(
          'Optional: filter results by entity type (function, class, module, endpoint, etc.).',
        ),
      limit: z
        .string()
        .optional()
        .describe('Maximum number of results to return (default 20, max 100).'),
    },
    async ({ query, type, limit: limitStr }) => {
      const limit = limitStr ? Math.max(1, Math.min(parseInt(limitStr, 10) || 20, 100)) : 20;
      if (!state.isInitialized()) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Project has not been analyzed yet. Run the analyze_project tool first.',
            },
          ],
          isError: true,
        };
      }

      try {
        const graph = state.getGraph();
        let results: Entity[];

        // Use FTS5 search if available (SQLite client)
        if ('searchEntities' in graph && typeof graph.searchEntities === 'function') {
          results = await graph.searchEntities!(query, {
            type: type || undefined,
            limit,
          });
        } else {
          // Fallback: LIKE-based search
          if (type) {
            const typed = await graph.getEntities(type as any);
            const q = query.toLowerCase();
            results = typed
              .filter(
                (e) =>
                  e.name.toLowerCase().includes(q) ||
                  e.qualified_name.toLowerCase().includes(q) ||
                  (e.description?.toLowerCase().includes(q) ?? false),
              )
              .slice(0, limit);
          } else {
            const searchPattern = `%${query}%`;
            const allRows = await graph.query(
              `SELECT * FROM entities WHERE name LIKE $pattern OR qualified_name LIKE $pattern LIMIT $limit`,
              { $pattern: searchPattern, $limit: limit },
            );
            results = allRows as Entity[];
          }
        }

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No entities found matching "${query}"${type ? ` (type: ${type})` : ''}.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# Search Results for "${query}"`,
          '',
          `Found **${results.length}** ${results.length === 1 ? 'entity' : 'entities'}${type ? ` of type \`${type}\`` : ''}:`,
          '',
        ];

        for (const entity of results) {
          lines.push(`## ${entity.name}`);
          lines.push(`- **ID:** \`${entity.id}\``);
          lines.push(`- **Type:** ${entity.type}`);
          lines.push(`- **Qualified Name:** \`${entity.qualified_name}\``);
          if (entity.description) {
            lines.push(`- **Description:** ${entity.description}`);
          }
          if (entity.source_location) {
            const loc = entity.source_location;
            lines.push(`- **Location:** ${loc.file}:${loc.start_line}-${loc.end_line}`);
          }
          lines.push('');
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Search failed: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
