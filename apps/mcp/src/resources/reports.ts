/**
 * @module @recurrsive/mcp/resources/reports
 *
 * MCP resource definitions for Recurrsive read-only data.
 *
 * Resources are identified by URIs and provide structured data that
 * AI assistants can read without side effects:
 *
 * - `recurrsive://health/latest` — Latest health score report
 * - `recurrsive://opportunities/top` — Top 10 opportunities
 * - `recurrsive://graph/summary` — Knowledge graph statistics
 * - `recurrsive://timeline/latest` — Latest intelligence snapshot
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  Finding,
  MaturityDimension,
} from '@recurrsive/core';
import { state } from '../state.js';
import { computeHealthScore } from '../health.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely compute a health score. Returns 0 if the server is not initialized.
 *
 * @param opportunities - Current opportunities.
 * @param stats - Graph statistics.
 * @returns A health score between 0 and 100.
 */
// computeHealthScore is imported from ../health.js

// ---------------------------------------------------------------------------
// Resource Registration
// ---------------------------------------------------------------------------

/**
 * Register all MCP resources with the server.
 *
 * @param server - The MCP server instance to register resources on.
 */
export function registerReportResources(server: McpServer): void {
  // ── recurrsive://health/latest ─────────────────────────────────────────

  server.resource(
    'health-latest',
    'recurrsive://health/latest',
    {
      description: 'Latest health score report for the analyzed project. ' +
        'Includes overall score, per-dimension maturity, and top risks.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      if (!state.isInitialized()) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
          }],
        };
      }

      const cache = state.getAnalysisCache();
      if (!cache) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: 'Not analyzed yet — no analysis results are cached. ' +
              'Use the "analyze_project" tool first.',
          }],
        };
      }

      const findings = cache.findings;
      const opportunities = state.getOpportunities().list();
      const stats = await state.getGraph().getStats();
      // Canonical score is derived from findings (see health.ts).
      const health = computeHealthScore(findings);

      const dimensions: MaturityDimension[] = [
        'architecture', 'ai', 'security', 'operational', 'product',
        'developer_experience', 'reliability', 'data', 'documentation', 'testing',
      ];

      const categoryToDimension: Record<string, string> = {
        architecture: 'architecture', ai_quality: 'ai', security: 'security',
        infrastructure: 'operational', product: 'product',
        developer_experience: 'developer_experience', reliability: 'reliability',
        data: 'data', documentation: 'documentation', performance: 'operational',
        cost: 'operational', ux: 'product', accessibility: 'product',
        privacy: 'security', compliance: 'security',
      };

      const lines = [
        `# Health Report`,
        '',
        `**Overall Health Score:** ${health}/100`,
        `**Project:** ${state.getProjectInfo().name}`,
        `**Total Entities:** ${stats.totalEntities}`,
        `**Total Relationships:** ${stats.totalRelationships}`,
        `**Findings:** ${findings.length}`,
        `**Open Opportunities:** ${opportunities.length}`,
        '',
        '## Findings by Dimension',
        '',
        '| Dimension | Findings | Severity Breakdown |',
        '| --- | --- | --- |',
      ];

      for (const dim of dimensions) {
        const dimFindings = findings.filter((f: Finding) => categoryToDimension[f.category] === dim);
        const severityBreakdown = ['critical', 'high', 'medium', 'low', 'info']
          .map((s) => {
            const count = dimFindings.filter((f: Finding) => f.severity === s).length;
            return count > 0 ? `${s}: ${count}` : null;
          })
          .filter(Boolean)
          .join(', ');
        lines.push(`| ${dim} | ${dimFindings.length} | ${severityBreakdown || '—'} |`);
      }

      lines.push('', `**Last analyzed:** ${cache.analyzedAt}`);
      lines.push(`**Analysis duration:** ${(cache.durationMs / 1000).toFixed(1)}s`);

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: lines.join('\n'),
        }],
      };
    },
  );

  // ── recurrsive://opportunities/top ─────────────────────────────────────

  server.resource(
    'opportunities-top',
    'recurrsive://opportunities/top',
    {
      description: 'Top 10 prioritized opportunities from the most recent analysis.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      if (!state.isInitialized()) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
          }],
        };
      }

      const top = state.getOpportunities().getTopN(10);

      if (top.length === 0) {
        // Opportunities only exist when reasoning (LLM) has run. Zero
        // opportunities does NOT mean a healthy project — there may be many
        // unresolved findings. Report honestly based on findings.
        const cache = state.getAnalysisCache();
        const findingCount = cache?.findings.length ?? 0;
        const text = findingCount > 0
          ? `No opportunities are available. Reasoning may not have run ` +
            `(opportunities require an LLM key). ${findingCount} raw finding(s) ` +
            `were detected — use the "list_findings" tool to review them.`
          : 'No opportunities and no findings were produced by the latest analysis.';
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text,
          }],
        };
      }

      const lines = [
        `# Top ${top.length} Opportunities`,
        '',
      ];

      for (let i = 0; i < top.length; i++) {
        const opp = top[i]!;
        lines.push(
          `## ${i + 1}. ${opp.title}`,
          '',
          `- **ID:** \`${opp.id}\``,
          `- **Category:** ${opp.category}`,
          `- **Severity:** ${opp.severity}`,
          `- **Type:** ${opp.type}`,
          `- **Confidence:** ${(opp.confidence * 100).toFixed(0)}%`,
          `- **Effort:** ${opp.effort.t_shirt}`,
          '',
          `**Problem:** ${opp.problem}`,
          '',
          `**Recommendation:** ${opp.recommendation}`,
          '',
          `**Impact:** ${opp.expected_impact.summary}`,
          '',
          '---',
          '',
        );
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: lines.join('\n'),
        }],
      };
    },
  );

  // ── recurrsive://graph/summary ─────────────────────────────────────────

  server.resource(
    'graph-summary',
    'recurrsive://graph/summary',
    {
      description: 'Knowledge graph statistics: entity and relationship counts by type.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      if (!state.isInitialized()) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
          }],
        };
      }

      const stats = await state.getGraph().getStats();

      const lines = [
        `# Knowledge Graph Summary`,
        '',
        `**Total Entities:** ${stats.totalEntities}`,
        `**Total Relationships:** ${stats.totalRelationships}`,
        '',
        '## Entities by Type',
        '',
        '| Type | Count |',
        '| --- | --- |',
      ];

      const sortedEntityTypes = Object.entries(stats.entityCountsByType)
        .sort(([, a], [, b]) => b - a);
      for (const [entityType, count] of sortedEntityTypes) {
        lines.push(`| ${entityType} | ${count} |`);
      }

      lines.push(
        '',
        '## Relationships by Type',
        '',
        '| Type | Count |',
        '| --- | --- |',
      );

      const sortedRelTypes = Object.entries(stats.relationshipCountsByType)
        .sort(([, a], [, b]) => b - a);
      for (const [relType, count] of sortedRelTypes) {
        lines.push(`| ${relType} | ${count} |`);
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: lines.join('\n'),
        }],
      };
    },
  );

  // ── recurrsive://timeline/latest ───────────────────────────────────────

  server.resource(
    'timeline-latest',
    'recurrsive://timeline/latest',
    {
      description: 'Latest intelligence snapshot: health score, findings count, ' +
        'opportunity count, and analysis timing.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      if (!state.isInitialized()) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: 'No analysis has been run yet. Use the "analyze_project" tool first.',
          }],
        };
      }

      const cache = state.getAnalysisCache();
      const stats = await state.getGraph().getStats();
      // Canonical score is derived from findings (see health.ts); null-safe
      // when no analysis has been cached.
      const health = cache ? computeHealthScore(cache.findings) : null;

      const lines = [
        `# Intelligence Snapshot`,
        '',
        `**Project:** ${state.getProjectInfo().name}`,
        `**Health Score:** ${health === null ? 'Not analyzed yet' : `${health}/100`}`,
        '',
      ];

      if (cache) {
        lines.push(
          `**Analyzed At:** ${cache.analyzedAt}`,
          `**Duration:** ${(cache.durationMs / 1000).toFixed(1)}s`,
          `**Findings:** ${cache.findings.length}`,
          `**Opportunities:** ${cache.opportunities.length}`,
          '',
        );

        // Category breakdown
        const bySeverity = new Map<string, number>();
        for (const opp of cache.opportunities) {
          const count = bySeverity.get(opp.severity) ?? 0;
          bySeverity.set(opp.severity, count + 1);
        }

        if (bySeverity.size > 0) {
          lines.push('## Opportunities by Severity', '');
          for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
            const count = bySeverity.get(sev);
            if (count !== undefined && count > 0) {
              lines.push(`- **${sev}:** ${count}`);
            }
          }
          lines.push('');
        }

        // Type breakdown
        const byType = new Map<string, number>();
        for (const opp of cache.opportunities) {
          const count = byType.get(opp.type) ?? 0;
          byType.set(opp.type, count + 1);
        }

        if (byType.size > 0) {
          lines.push('## Opportunities by Type', '');
          for (const [type, count] of byType.entries()) {
            lines.push(`- **${type}:** ${count}`);
          }
          lines.push('');
        }
      } else {
        lines.push(
          '> No analysis results cached. Run `analyze_project` to generate a snapshot.',
          '',
        );
      }

      lines.push(
        '## Graph Size',
        '',
        `- **Entities:** ${stats.totalEntities}`,
        `- **Relationships:** ${stats.totalRelationships}`,
      );

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: lines.join('\n'),
        }],
      };
    },
  );
}
