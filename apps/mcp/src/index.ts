/**
 * @module @recurrsive/mcp
 *
 * MCP (Model Context Protocol) server for Recurrsive.
 *
 * Exposes Recurrsive's analysis capabilities to AI coding assistants
 * like Claude, Cursor, and Copilot through the Model Context Protocol.
 *
 * ## Quick Start
 *
 * ```json
 * // In your MCP client configuration (e.g. Claude Desktop):
 * {
 *   "mcpServers": {
 *     "recurrsive": {
 *       "command": "npx",
 *       "args": ["recurrsive-mcp"]
 *     }
 *   }
 * }
 * ```
 *
 * ## Programmatic Usage
 *
 * ```ts
 * import { createServer, startServer } from '@recurrsive/mcp';
 *
 * // Option 1: Start on stdio (for MCP clients)
 * await startServer();
 *
 * // Option 2: Create server for custom transport
 * const server = createServer();
 * ```
 *
 * @packageDocumentation
 */

export { createServer, startServer } from './server.js';
