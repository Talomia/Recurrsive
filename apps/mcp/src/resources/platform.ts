/**
 * @module @recurrsive/mcp/resources/platform
 *
 * MCP resource definitions for platform-level operational data.
 *
 * Resources are identified by URIs and provide structured data that
 * AI assistants can read without side effects:
 *
 * - `recurrsive://platform/status` — Platform status overview
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthResponse {
  status: string;
  version: string;
  uptime: string;
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
      try {
        const health = await apiRequest<HealthResponse>('/api/v1/health');
        const lines = [
          '# Platform Status',
          '',
          `**Version:** ${health.version}`,
          `**Uptime:** ${health.uptime}`,
          `**Status:** ${health.status}`,
        ];
        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: `Platform status unavailable: ${message}`,
          }],
        };
      }
    },
  );
}
