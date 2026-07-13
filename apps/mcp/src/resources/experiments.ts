/**
 * @module @recurrsive/mcp/resources/experiments
 *
 * MCP resource definitions for engineering experiments.
 *
 * Resources are identified by URIs and provide structured data that
 * AI assistants can read without side effects:
 *
 * - `recurrsive://experiments/active` — Currently active engineering experiments
 * - `recurrsive://experiments/results` — Completed experiment results and conclusions
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiErrorMessage, apiGet, projectScopedPath } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  variants: Array<{ name: string }>;
  metrics: Array<{
    name: string;
    variant_a: number;
    variant_b: number;
    difference: number;
    preferred: 'a' | 'b' | 'tie';
  }>;
  conclusion: string | null;
  error: string | null;
}

function errorResource(uri: URL, error: unknown) {
  return {
    contents: [{
      uri: uri.href,
      mimeType: 'text/plain',
      text: apiErrorMessage(error, 'load experiments'),
    }],
  };
}

// ---------------------------------------------------------------------------
// Resource Registration
// ---------------------------------------------------------------------------

/**
 * Register experiment MCP resources with the server.
 *
 * @param server - The MCP server instance to register resources on.
 */
export function registerExperimentResources(server: McpServer): void {
  // ── recurrsive://experiments/active ──────────────────────────────────

  server.resource(
    'experiments-active',
    'recurrsive://experiments/active',
    {
      description: 'Currently active engineering experiments with progress and configuration.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      try {
        const allExperiments = await apiGet<Experiment[]>(
          projectScopedPath('/api/v1/experiments'),
        );

        const activeExperiments = allExperiments.filter(
          experiment => experiment.status === 'pending' || experiment.status === 'running',
        );

        const lines = [
          '# Active Experiments',
          '',
          `**Total Active:** ${activeExperiments.length}`,
          '',
          '| ID | Name | Status | Started | Variants |',
          '| --- | --- | --- | --- | --- |',
        ];

        for (const experiment of activeExperiments) {
          lines.push(
            `| ${experiment.id} | ${experiment.name} | ${experiment.status} | ${experiment.startedAt ?? 'Not started'} | ${experiment.variants.map((variant) => variant.name).join(' vs ')} |`,
          );
        }

        lines.push('');

        for (const experiment of activeExperiments) {
          lines.push(`## ${experiment.name} (${experiment.id})`);
          lines.push('');
          lines.push(`**Hypothesis:** ${experiment.hypothesis}`);
          lines.push(`**Variants:** ${experiment.variants.map((variant) => variant.name).join(' vs ')}`);
          lines.push('');
        }

        lines.push(
          '> Use the `list_experiments` tool to get real-time experiment data ' +
          'and `create_experiment` to start new experiments.',
        );

        return {
          contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }],
        };
      } catch (error) {
        return errorResource(uri, error);
      }
    },
  );

  // ── recurrsive://experiments/results ─────────────────────────────────

  server.resource(
    'experiments-results',
    'recurrsive://experiments/results',
    {
      description: 'Completed experiment results with metrics and conclusions.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      try {
        const allExperiments = await apiGet<Experiment[]>(
          projectScopedPath('/api/v1/experiments'),
        );

        const completedExperiments = allExperiments.filter(experiment => experiment.status === 'completed');

        const lines = [
          '# Experiment Results',
          '',
          `**Total Completed:** ${completedExperiments.length}`,
          '',
          '| ID | Name | Duration | Conclusion |',
          '| --- | --- | --- | --- |',
        ];

        for (const experiment of completedExperiments) {
          const durationMs = experiment.startedAt && experiment.completedAt
            ? new Date(experiment.completedAt).getTime() - new Date(experiment.startedAt).getTime()
            : null;
          const duration = durationMs === null ? '—' : `${Math.round(durationMs / 1000)}s`;
          const shortConclusion = experiment.conclusion
            ? `${experiment.conclusion.substring(0, 60)}${experiment.conclusion.length > 60 ? '…' : ''}`
            : '—';
          lines.push(`| ${experiment.id} | ${experiment.name} | ${duration} | ${shortConclusion} |`);
        }

        lines.push('');

        for (const experiment of completedExperiments) {
          lines.push(`## ${experiment.name} (${experiment.id})`);
          lines.push('');
          lines.push(`**Hypothesis:** ${experiment.hypothesis}`);
          lines.push(`**Period:** ${experiment.startedAt ?? '—'} → ${experiment.completedAt ?? '—'}`);
          lines.push(`**Conclusion:** ${experiment.conclusion ?? 'No conclusion recorded.'}`);
          lines.push('');
          lines.push('| Metric | Variant A | Variant B | Difference | Preferred |');
          lines.push('| --- | --- | --- | --- | --- |');
          for (const metric of experiment.metrics) {
            lines.push(`| ${metric.name} | ${metric.variant_a} | ${metric.variant_b} | ${metric.difference} | ${metric.preferred} |`);
          }
          lines.push('');
        }

        lines.push('> Use the `list_experiments` tool with a status filter for real-time data.');

        return {
          contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }],
        };
      } catch (error) {
        return errorResource(uri, error);
      }
    },
  );
}
