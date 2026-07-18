/**
 * @module @recurrsive/mcp/server
 *
 * MCP server setup and lifecycle management.
 *
 * Creates a Model Context Protocol server that exposes Recurrsive's
 * analysis capabilities to AI coding assistants like Claude, Cursor,
 * and Copilot.
 *
 * @packageDocumentation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VERSION } from '@recurrsive/core';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';
import { state } from './state.js';

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Create a configured MCP server with all tools, resources, and prompts
 * registered.
 *
 * The server exposes:
 * - **45 tools** for analysis, inspection, governance, batch operations,
 *   webhooks, forecasting, simulation, and platform management
 * - **6 resource modules** for read-only access to health, opportunities,
 *   graph statistics, timeline, analytics, and configuration
 * - **7 prompt modules** for guided report interpretation, improvement
 *   planning, and opportunity explanation
 *
 * @returns A fully configured MCP server instance.
 *
 * @example
 * ```ts
 * import { createServer } from '@recurrsive/mcp';
 * import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
 *
 * const server = createServer();
 * const transport = new StdioServerTransport();
 * await server.connect(transport);
 * ```
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'recurrsive',
    version: VERSION,
    description:
      'Engineering Intelligence Platform — continuously analyze ' +
      'and improve software systems through knowledge graph construction, ' +
      'multi-analyzer inspection, and multi-agent reasoning.',
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

// ---------------------------------------------------------------------------
// Server Lifecycle
// ---------------------------------------------------------------------------

/**
 * Create and start the MCP server on a stdio transport.
 *
 * This is the primary entry point for the `recurrsive-mcp` binary.
 * The server communicates with the AI assistant over stdin/stdout
 * using the Model Context Protocol.
 *
 * @throws {Error} If the transport connection fails.
 *
 * @example
 * ```ts
 * import { startServer } from '@recurrsive/mcp';
 * await startServer();
 * ```
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Clean up state on process exit
  const cleanup = async (): Promise<void> => {
    await state.dispose();
  };

  process.on('SIGINT', () => {
    void cleanup().then(() => process.exit(0)).catch(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    void cleanup().then(() => process.exit(0)).catch(() => process.exit(1));
  });

  await server.connect(transport);
}
