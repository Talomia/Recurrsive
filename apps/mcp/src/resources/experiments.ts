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
      const activeExperiments = [
        {
          id: 'exp_001',
          name: 'Incremental Analysis',
          hypothesis: 'Incremental analysis reduces re-analysis time by 70%',
          status: 'running',
          progress: 65,
          started_at: '2024-12-01T09:00:00Z',
          variants: ['Full Re-analysis (Control)', 'Incremental Diff (Treatment)'],
          metrics: { control_avg_ms: 4500, treatment_avg_ms: 1350 },
        },
        {
          id: 'exp_003',
          name: 'Graph Compression',
          hypothesis: 'Compressed graph storage reduces memory usage by 40%',
          status: 'running',
          progress: 30,
          started_at: '2024-12-10T14:00:00Z',
          variants: ['Standard Storage (Control)', 'Compressed Nodes (Treatment)'],
          metrics: { control_memory_mb: 512, treatment_memory_mb: 310 },
        },
        {
          id: 'exp_005',
          name: 'Parallel Collector Execution',
          hypothesis: 'Running collectors in parallel reduces collection time by 50%',
          status: 'running',
          progress: 45,
          started_at: '2024-12-15T10:00:00Z',
          variants: ['Sequential (Control)', 'Parallel Workers (Treatment)'],
          metrics: { control_duration_s: 120, treatment_duration_s: 58 },
        },
      ];

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
          `| ${exp.id} | ${exp.name} | ${exp.progress}% | ${exp.status} | ${exp.started_at} |`,
        );
      }

      lines.push('');

      for (const exp of activeExperiments) {
        lines.push(`## ${exp.name} (${exp.id})`);
        lines.push('');
        lines.push(`**Hypothesis:** ${exp.hypothesis}`);
        lines.push(`**Progress:** ${exp.progress}%`);
        lines.push(`**Variants:** ${exp.variants.join(' vs ')}`);
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
      const completedExperiments = [
        {
          id: 'exp_002',
          name: 'Cache-First Analysis',
          hypothesis: 'Caching analysis results reduces repeated query latency by 80%',
          status: 'completed',
          started_at: '2024-11-15T08:00:00Z',
          completed_at: '2024-12-01T16:00:00Z',
          conclusion: 'Confirmed. Cache-first strategy reduced repeated query latency by 85%, ' +
            'exceeding the 80% target. Recommended for production deployment.',
          metrics: {
            control_latency_ms: 320,
            treatment_latency_ms: 48,
            improvement_pct: 85,
            cache_hit_rate: 0.92,
          },
          outcome: 'positive',
        },
        {
          id: 'exp_004',
          name: 'Severity-Weighted Scoring',
          hypothesis: 'Weighting health scores by severity improves prioritization accuracy',
          status: 'completed',
          started_at: '2024-11-01T10:00:00Z',
          completed_at: '2024-11-28T14:00:00Z',
          conclusion: 'Partially confirmed. Severity weighting improved critical issue ' +
            'detection by 40% but slightly decreased low-severity accuracy. ' +
            'Recommend adopting with tuned weights.',
          metrics: {
            critical_detection_improvement: 40,
            low_severity_accuracy_delta: -5,
            overall_accuracy_improvement: 22,
          },
          outcome: 'partial',
        },
        {
          id: 'exp_006',
          name: 'Batch Analysis Chunking',
          hypothesis: 'Processing batch analyses in chunks of 3 reduces memory spikes by 60%',
          status: 'completed',
          started_at: '2024-10-20T09:00:00Z',
          completed_at: '2024-11-10T11:00:00Z',
          conclusion: 'Confirmed. Chunked processing reduced peak memory by 62% with only ' +
            'a 5% increase in total wall-clock time. Adopted as default strategy.',
          metrics: {
            peak_memory_reduction_pct: 62,
            wall_clock_overhead_pct: 5,
            chunk_size: 3,
          },
          outcome: 'positive',
        },
      ];

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
        const start = new Date(exp.started_at);
        const end = new Date(exp.completed_at);
        const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const shortConclusion = exp.conclusion.substring(0, 60) + '...';
        lines.push(
          `| ${exp.id} | ${exp.name} | ${exp.outcome} | ${durationDays}d | ${shortConclusion} |`,
        );
      }

      lines.push('');

      for (const exp of completedExperiments) {
        lines.push(`## ${exp.name} (${exp.id})`);
        lines.push('');
        lines.push(`**Hypothesis:** ${exp.hypothesis}`);
        lines.push(`**Outcome:** ${exp.outcome}`);
        lines.push(`**Period:** ${exp.started_at} → ${exp.completed_at}`);
        lines.push('');
        lines.push(`**Conclusion:** ${exp.conclusion}`);
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
