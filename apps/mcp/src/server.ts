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
 * - **5 tools** for analysis, opportunity browsing, graph querying, and
 *   health scoring
 * - **4 resources** for read-only access to health reports, top
 *   opportunities, graph statistics, and intelligence timeline
 * - **3 prompts** for guided health report interpretation, improvement
 *   cycle planning, and opportunity explanation
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
    version: '0.1.0',
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
    void cleanup().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void cleanup().then(() => process.exit(0));
  });

  await server.connect(transport);
}
