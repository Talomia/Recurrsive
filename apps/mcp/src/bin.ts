#!/usr/bin/env node

/**
 * @module @recurrsive/mcp/bin
 *
 * CLI entry point for the Recurrsive MCP server.
 *
 * Starts the MCP server on a stdio transport for communication with
 * AI coding assistants.
 *
 * @packageDocumentation
 */

import { startServer } from './server.js';

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[recurrsive-mcp] Fatal error: ${message}\n`);
  process.exit(1);
});
