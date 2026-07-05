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
import { apiGet } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: string;
  progress?: number;
  started_at: string;
  completed_at?: string;
  variants?: string[];
  metrics: Record<string, number>;
  conclusion?: string;
  outcome?: string;
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
      let allExperiments: Experiment[] = [];

      try {
        allExperiments = await apiGet<Experiment[]>('/api/v1/experiments');
      } catch {
        // API unavailable — fall back to empty list
      }

      const activeExperiments = allExperiments.filter(
        e => e.status === 'running' || e.status === 'active',
      );

      const lines = [
        '# Active Experiments',
        '',
        `**Total Active:** ${activeExperiments.length}`,
        '',
        '| ID | Name | Progress | Status | Started |',
        '| --- | --- | --- | --- | --- |',
      ];

      for (const exp of activeExperiments) {
        lines.push(
          `| ${exp.id} | ${exp.name} | ${exp.progress ?? 0}% | ${exp.status} | ${exp.started_at} |`,
        );
      }

      lines.push('');

      for (const exp of activeExperiments) {
        lines.push(`## ${exp.name} (${exp.id})`);
        lines.push('');
        lines.push(`**Hypothesis:** ${exp.hypothesis}`);
        lines.push(`**Progress:** ${exp.progress ?? 0}%`);
        if (exp.variants && exp.variants.length > 0) {
          lines.push(`**Variants:** ${exp.variants.join(' vs ')}`);
        }
        lines.push('');
        lines.push('**Current Metrics:**');
        for (const [key, value] of Object.entries(exp.metrics)) {
          lines.push(`- ${key}: ${value}`);
        }
        lines.push('');
      }

      lines.push(
        '> Use the `list_experiments` tool to get real-time experiment data ' +
        'and `create_experiment` to start new experiments.',
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

  // ── recurrsive://experiments/results ─────────────────────────────────

  server.resource(
    'experiments-results',
    'recurrsive://experiments/results',
    {
      description: 'Completed experiment results with metrics and conclusions.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let allExperiments: Experiment[] = [];

      try {
        allExperiments = await apiGet<Experiment[]>('/api/v1/experiments');
      } catch {
        // API unavailable — fall back to empty list
      }

      const completedExperiments = allExperiments.filter(e => e.status === 'completed');

      const lines = [
        '# Experiment Results',
        '',
        `**Total Completed:** ${completedExperiments.length}`,
        `**Positive Outcomes:** ${completedExperiments.filter(e => e.outcome === 'positive').length}`,
        `**Partial Outcomes:** ${completedExperiments.filter(e => e.outcome === 'partial').length}`,
        '',
        '| ID | Name | Outcome | Duration | Conclusion |',
        '| --- | --- | --- | --- | --- |',
      ];

      for (const exp of completedExperiments) {
        let durationStr = '—';
        if (exp.started_at && exp.completed_at) {
          const start = new Date(exp.started_at);
          const end = new Date(exp.completed_at);
          const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          durationStr = `${durationDays}d`;
        }
        const shortConclusion = exp.conclusion
          ? exp.conclusion.substring(0, 60) + '...'
          : '—';
        lines.push(
          `| ${exp.id} | ${exp.name} | ${exp.outcome ?? '—'} | ${durationStr} | ${shortConclusion} |`,
        );
      }

      lines.push('');

      for (const exp of completedExperiments) {
        lines.push(`## ${exp.name} (${exp.id})`);
        lines.push('');
        lines.push(`**Hypothesis:** ${exp.hypothesis}`);
        lines.push(`**Outcome:** ${exp.outcome ?? '—'}`);
        lines.push(`**Period:** ${exp.started_at} → ${exp.completed_at ?? '—'}`);
        lines.push('');
        lines.push(`**Conclusion:** ${exp.conclusion ?? 'No conclusion recorded.'}`);
        lines.push('');
        lines.push('**Final Metrics:**');
        for (const [key, value] of Object.entries(exp.metrics)) {
          lines.push(`- ${key}: ${value}`);
        }
        lines.push('');
      }

      lines.push(
        '> Use the `list_experiments` tool with status filter for real-time data.',
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
