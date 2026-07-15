/**
 * @module @recurrsive/mcp/resources/platform
 *
 * MCP resource definitions for platform-level operational data.
 *
 * Resources are identified by URIs and provide structured data that
 * AI assistants can read without side effects:
 *
 * - `recurrsive://platform/status` — Platform status overview
 * - `recurrsive://plugins/installed` — Installed plugins list
 * - `recurrsive://tenants/overview` — Multi-tenant overview
 * - `recurrsive://benchmarks/latest` — Latest cloud benchmarks
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiGet, apiRequest } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthResponse {
  status: string;
  version: string;
  uptime: string;
}

interface Plugin {
  name: string;
  version: string;
  status: string;
  type: string;
}

interface Tenant {
  name: string;
  tier: string;
  projects: number;
  usagePct: number;
  activeUsers: number;
}

interface BenchmarkReport {
  industry: string;
  sampleSize: number;
  percentiles?: { p25: number; p50: number; p75: number; p90: number };
  dimensionAverages?: Record<string, number>;
  topImprovementAreas?: string[];
  message?: string;
}

// ---------------------------------------------------------------------------
// Resource Registration
// ---------------------------------------------------------------------------

/**
 * Register platform MCP resources with the server.
 *
 * @param server - The MCP server instance to register resources on.
 */
export function registerPlatformResources(server: McpServer): void {
  // ── recurrsive://platform/status ────────────────────────────────────────

  server.resource(
    'platform-status',
    'recurrsive://platform/status',
    {
      description: 'Platform status overview including uptime, version, ' +
        'connected services, and system health indicators.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let status = 'Unknown';
      let version = 'Unknown';
      let uptime = 'Unknown';

      try {
        const health = await apiRequest<HealthResponse>('/api/v1/health');
        status = health.status ?? 'Unknown';
        version = health.version ?? 'Unknown';
        uptime = health.uptime ?? 'Unknown';
      } catch {
        // API unavailable — show unknown values
      }

      const lines = [
        '# Platform Status',
        '',
        `**Version:** ${version}`,
        `**Uptime:** ${uptime}`,
        `**Status:** ${status}`,
      ];

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );

  // ── recurrsive://plugins/installed ──────────────────────────────────────

  server.resource(
    'plugins-installed',
    'recurrsive://plugins/installed',
    {
      description: 'List of installed plugins with version, status, and capabilities.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let plugins: Plugin[] = [];

      try {
        plugins = await apiGet<Plugin[]>('/api/v1/plugins/installed');
      } catch {
        // API unavailable — fall back to empty list
      }

      const lines = [
        '# Installed Plugins',
        '',
        `**Total:** ${plugins.length}`,
        `**Active:** ${plugins.filter(p => p.status === 'active').length}`,
        '',
        '| Plugin | Version | Status | Type |',
        '| --- | --- | --- | --- |',
      ];

      for (const p of plugins) {
        const icon = p.status === 'active' ? '✅' : '⏸️';
        lines.push(`| ${p.name} | ${p.version} | ${icon} ${p.status} | ${p.type} |`);
      }

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );

  // ── recurrsive://tenants/overview ───────────────────────────────────────

  server.resource(
    'tenants-overview',
    'recurrsive://tenants/overview',
    {
      description: 'Multi-tenant overview with project counts, usage quotas, ' +
        'and billing tier information.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let tenants: Tenant[] = [];

      try {
        tenants = await apiGet<Tenant[]>('/api/v1/tenants');
      } catch {
        // API unavailable — fall back to empty list
      }

      const lines = [
        '# Multi-Tenant Overview',
        '',
        `**Total Tenants:** ${tenants.length}`,
        `**Total Projects:** ${tenants.reduce((s, t) => s + t.projects, 0)}`,
        '',
        '| Tenant | Tier | Projects | Usage | Active Users |',
        '| --- | --- | --- | --- | --- |',
      ];

      for (const t of tenants) {
        lines.push(`| ${t.name} | ${t.tier} | ${t.projects} | ${t.usagePct}% | ${t.activeUsers} |`);
      }

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );

  // ── recurrsive://benchmarks/latest ──────────────────────────────────────

  server.resource(
    'benchmarks-latest',
    'recurrsive://benchmarks/latest',
    {
      description: 'Anonymized industry benchmark report — health-score ' +
        'percentiles and per-dimension averages aggregated across submitted ' +
        'benchmarks.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let report: BenchmarkReport | null = null;

      try {
        report = await apiGet<BenchmarkReport>('/api/v1/cloud/benchmarks/report');
      } catch {
        // API unavailable — report stays null
      }

      const lines = ['# Industry Benchmark Report', ''];

      if (!report || (report.sampleSize ?? 0) === 0) {
        lines.push('No benchmark data available yet. Benchmarks are populated as ' +
          'organizations opt in and submit anonymized scores.');
      } else {
        lines.push(
          `**Industry:** ${report.industry}`,
          `**Sample size:** ${report.sampleSize}`,
          '',
        );

        if (report.percentiles) {
          lines.push(
            '## Overall Score Percentiles',
            '',
            '| p25 | p50 | p75 | p90 |',
            '| --- | --- | --- | --- |',
            `| ${report.percentiles.p25} | ${report.percentiles.p50} | ${report.percentiles.p75} | ${report.percentiles.p90} |`,
            '',
          );
        }

        if (report.dimensionAverages && Object.keys(report.dimensionAverages).length > 0) {
          lines.push('## Dimension Averages', '', '| Dimension | Average |', '| --- | --- |');
          for (const [dim, avg] of Object.entries(report.dimensionAverages)) {
            lines.push(`| ${dim} | ${avg} |`);
          }
          lines.push('');
        }

        if (report.topImprovementAreas && report.topImprovementAreas.length > 0) {
          lines.push(`**Top improvement areas:** ${report.topImprovementAreas.join(', ')}`);
        }
      }

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );
}
