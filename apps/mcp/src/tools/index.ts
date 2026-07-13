/**
 * @module @recurrsive/mcp/tools
 *
 * Barrel export for MCP tool registrations.
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAnalyzeTools } from './analyze.js';
import { registerInspectTools } from './inspect.js';
import { registerGovernanceTools } from './governance.js';
import { registerWebhookTools } from './webhooks.js';
import { registerBatchTools } from './batch.js';
import { registerExperimentTools } from './experiments.js';
import { registerSearchTools } from './search.js';
import { registerSnapshotTools } from './snapshots.js';
import { registerExportTools } from './export.js';
import { registerProjectTools } from './projects.js';
import { registerForecastTools } from './forecasting.js';
import { registerPlatformTools } from './platform.js';

/**
 * Register all MCP tools with the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerTools(server: McpServer): void {
  registerAnalyzeTools(server);
  registerInspectTools(server);
  registerGovernanceTools(server);
  registerWebhookTools(server);
  registerBatchTools(server);
  registerExperimentTools(server);
  registerSearchTools(server);
  registerSnapshotTools(server);
  registerExportTools(server);
  registerProjectTools(server);
  registerForecastTools(server);
  registerPlatformTools(server);
}
