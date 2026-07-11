/**
 * @module @recurrsive/mcp/tools/governance
 *
 * MCP tool definitions for governance, snapshot, and comparison features.
 *
 * Provides four tools:
 * - `export_snapshot` — Export the knowledge graph as a portable JSON snapshot
 * - `import_snapshot` — Import entities and relationships from a snapshot file
 * - `evaluate_policies` — Evaluate opportunities against active policy rules
 * - `compare_analyses` — Compare findings/opportunities between analysis runs
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Entity, Relationship } from '@recurrsive/core';
import { PolicyEngine, BUILTIN_POLICIES } from '@recurrsive/policy';
import { state } from '../state.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Snapshot file format (mirrors server route definition). */
interface Snapshot {
  version: string;
  exported_at: string;
  project: string;
  entities: Entity[];
  relationships: Relationship[];
  stats: {
    entity_count: number;
    relationship_count: number;
    entity_types: Record<string, number>;
    relationship_types: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all governance tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerGovernanceTools(server: McpServer): void {
  // ── export_snapshot ──────────────────────────────────────────────────────

  server.tool(
    'export_snapshot',
    'Export the knowledge graph as a portable JSON snapshot. ' +
    'Returns a full dump of all entities, relationships, and graph stats ' +
    'that can be saved and later re-imported.',
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

        const graph = state.getGraph();
        const graphStats = await graph.getStats();

        // Fetch all entities by type
        const allEntities: Entity[] = [];
        for (const type of Object.keys(graphStats.entityCountsByType)) {
          const typed = await graph.getEntities(type as any);
          allEntities.push(...typed);
        }

        // Fetch all relationships (deduplicated)
        const allRelationships: Relationship[] = [];
        const seenRelIds = new Set<string>();
        for (const entity of allEntities) {
          const rels = await graph.getRelationships(entity.id);
          for (const rel of rels) {
            if (!seenRelIds.has(rel.id)) {
              seenRelIds.add(rel.id);
              allRelationships.push(rel);
            }
          }
        }

        const snapshot: Snapshot = {
          version: '0.2.0',
          exported_at: new Date().toISOString(),
          project: state.getProjectPath(),
          entities: allEntities,
          relationships: allRelationships,
          stats: {
            entity_count: allEntities.length,
            relationship_count: allRelationships.length,
            entity_types: graphStats.entityCountsByType,
            relationship_types: graphStats.relationshipCountsByType,
          },
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(snapshot, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to export snapshot: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── import_snapshot ──────────────────────────────────────────────────────

  server.tool(
    'import_snapshot',
    'Import entities and relationships from a previously exported snapshot ' +
    'file into the knowledge graph. Upserts all records from the snapshot.',
    {
      snapshot_path: z
        .string()
        .describe('Absolute path to the snapshot JSON file to import'),
    },
    async ({ snapshot_path }) => {
      try {
        if (!state.isInitialized()) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No analysis has been run yet. Use the "analyze_project" tool first to initialize the graph.',
            }],
          };
        }

        // Validate that snapshot_path is within the project directory
        const resolvedPath = path.resolve(snapshot_path);
        const projectPath = state.getProjectPath();
        if (projectPath && !resolvedPath.startsWith(path.resolve(projectPath))) {
          return {
            content: [{ type: 'text' as const, text: 'Error: snapshot_path must be within the project directory' }],
            isError: true,
          };
        }

        // Read and parse the snapshot file
        let raw: string;
        try {
          raw = await fs.readFile(snapshot_path, 'utf-8');
        } catch (readErr) {
          const readMsg = readErr instanceof Error ? readErr.message : String(readErr);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to read snapshot file: ${readMsg}`,
            }],
            isError: true,
          };
        }

        let snapshot: Snapshot;
        try {
          snapshot = JSON.parse(raw) as Snapshot;
        } catch {
          return {
            content: [{
              type: 'text' as const,
              text: 'Invalid JSON in snapshot file.',
            }],
            isError: true,
          };
        }

        // Validate structure
        if (!Array.isArray(snapshot.entities) || !Array.isArray(snapshot.relationships)) {
          return {
            content: [{
              type: 'text' as const,
              text: 'Invalid snapshot format. Must contain "entities" and "relationships" arrays.',
            }],
            isError: true,
          };
        }

        const graph = state.getGraph();
        let entitiesImported = 0;
        let relationshipsImported = 0;

        // Upsert entities
        for (const entity of snapshot.entities) {
          await graph.upsertEntity(entity);
          entitiesImported++;
        }

        // Upsert relationships
        for (const rel of snapshot.relationships) {
          await graph.upsertRelationship(rel);
          relationshipsImported++;
        }

        const result = {
          message: 'Snapshot imported successfully',
          entities_imported: entitiesImported,
          relationships_imported: relationshipsImported,
          source_version: snapshot.version ?? 'unknown',
          source_project: snapshot.project ?? 'unknown',
          exported_at: snapshot.exported_at ?? 'unknown',
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to import snapshot: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── evaluate_policies ───────────────────────────────────────────────────

  server.tool(
    'evaluate_policies',
    'Evaluate opportunities against active policy rules. ' +
    'Returns a compliance report showing which opportunities pass, ' +
    'are blocked, require approval, or have warnings.',
    {
      opportunity_ids: z
        .array(z.string())
        .optional()
        .describe(
          'Optional list of opportunity UUIDs to evaluate. ' +
          'If omitted, evaluates all opportunities.',
        ),
    },
    async ({ opportunity_ids }) => {
      try {
        if (!state.isInitialized()) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
            }],
          };
        }

        const engine = new PolicyEngine(BUILTIN_POLICIES);
        const manager = state.getOpportunities();
        const allOpportunities = manager.list();

        // Filter if specific IDs are requested
        const opportunities = opportunity_ids
          ? allOpportunities.filter((o) => opportunity_ids.includes(o.id))
          : allOpportunities;

        if (opportunities.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: opportunity_ids
                ? 'No opportunities found matching the specified IDs.'
                : 'No opportunities available. Run analysis with reasoning enabled first.',
            }],
          };
        }

        const results = opportunities.map((opp) => {
          const result = engine.passes(opp);
          return {
            opportunity_id: opp.id,
            opportunity_title: opp.title,
            passed: result.passed,
            action: result.effectiveAction,
            violations: result.violations.map((v) => ({
              rule_id: v.rule_id,
              action: v.action,
              message: v.message,
            })),
            warnings: result.warnings.map((w) => ({
              rule_id: w.rule_id,
              message: w.message,
            })),
          };
        });

        const passed = results.filter((r) => r.passed).length;
        const blocked = results.filter((r) => r.action === 'block').length;
        const needsApproval = results.filter((r) => r.action === 'require_approval').length;
        const warned = results.filter((r) => !r.passed && r.action === 'warn').length;

        const report = {
          results,
          summary: {
            total: results.length,
            passed,
            blocked,
            needs_approval: needsApproval,
            warned,
            compliance_rate: results.length > 0
              ? Math.round((passed / results.length) * 100)
              : 100,
          },
          policy_sets_active: engine.getPolicies().filter((ps) => ps.enabled).length,
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(report, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Policy evaluation failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── compare_analyses ────────────────────────────────────────────────────

  server.tool(
    'compare_analyses',
    'Compare findings and opportunities between analysis runs. ' +
    'Uses the cached analysis results to show what changed since ' +
    'the last analysis.',
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
              text: 'No analysis results cached. Use the "analyze_project" tool first.',
            }],
          };
        }

        const findings = cache.findings;
        const opportunities = cache.opportunities;

        // Group findings by severity
        const bySeverity = new Map<string, number>();
        for (const f of findings) {
          const count = bySeverity.get(f.severity) ?? 0;
          bySeverity.set(f.severity, count + 1);
        }

        // Group findings by category
        const byCategory = new Map<string, number>();
        for (const f of findings) {
          const count = byCategory.get(f.category) ?? 0;
          byCategory.set(f.category, count + 1);
        }

        // Group opportunities by type
        const oppsByType = new Map<string, number>();
        for (const o of opportunities) {
          const count = oppsByType.get(o.type) ?? 0;
          oppsByType.set(o.type, count + 1);
        }

        // Group opportunities by status
        const oppsByStatus = new Map<string, number>();
        for (const o of opportunities) {
          const count = oppsByStatus.get(o.status) ?? 0;
          oppsByStatus.set(o.status, count + 1);
        }

        const comparison = {
          analyzed_at: cache.analyzedAt,
          duration_ms: cache.durationMs,
          findings: {
            total: findings.length,
            by_severity: Object.fromEntries(bySeverity),
            by_category: Object.fromEntries(byCategory),
          },
          opportunities: {
            total: opportunities.length,
            by_type: Object.fromEntries(oppsByType),
            by_status: Object.fromEntries(oppsByStatus),
          },
          summary: [
            `Analysis produced ${findings.length} findings and ${opportunities.length} opportunities.`,
            findings.length > 0
              ? `Severity breakdown: ${[...bySeverity.entries()].map(([s, c]) => `${s}=${c}`).join(', ')}.`
              : '',
            opportunities.length > 0
              ? `Opportunity types: ${[...oppsByType.entries()].map(([t, c]) => `${t}=${c}`).join(', ')}.`
              : '',
          ].filter(Boolean).join(' '),
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(comparison, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Analysis comparison failed: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
