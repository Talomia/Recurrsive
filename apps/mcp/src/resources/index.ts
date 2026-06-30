/**
 * @module @recurrsive/mcp/resources
 *
 * Barrel export for MCP resource registrations.
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerReportResources } from './reports.js';
import { registerGovernanceResources } from './governance.js';
import { registerAnalyticsResources } from './analytics.js';

/**
 * Register all MCP resources with the server.
 *
 * @param server - The MCP server instance to register resources on.
 */
export function registerResources(server: McpServer): void {
  registerReportResources(server);
  registerGovernanceResources(server);
  registerAnalyticsResources(server);
}

