/**
 * @module @recurrsive/mcp/prompts
 *
 * Barrel export for MCP prompt registrations.
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPromptTemplates } from './templates.js';

/**
 * Register all MCP prompts with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerPrompts(server: McpServer): void {
  registerPromptTemplates(server);
}
