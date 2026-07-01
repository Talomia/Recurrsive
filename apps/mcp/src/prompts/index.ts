/**
 * @module @recurrsive/mcp/prompts
 *
 * Barrel export for MCP prompt registrations.
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPromptTemplates } from './templates.js';
import { registerAssessmentPrompts } from './assessments.js';
import { registerGovernancePrompts } from './governance.js';
import { registerOperationsPrompts } from './operations.js';
import { registerAnalysisPrompts } from './analysis.js';
import { registerIntelligencePrompts } from './intelligence.js';
import { registerPlatformPrompts } from './platform.js';

/**
 * Register all MCP prompts with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerPrompts(server: McpServer): void {
  registerPromptTemplates(server);
  registerAssessmentPrompts(server);
  registerGovernancePrompts(server);
  registerOperationsPrompts(server);
  registerAnalysisPrompts(server);
  registerIntelligencePrompts(server);
  registerPlatformPrompts(server);
}
