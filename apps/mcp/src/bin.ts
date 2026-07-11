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

// Catch uncaught exceptions that escape MCP SDK's error handling
process.on('uncaughtException', (error) => {
  process.stderr.write(`Fatal error: ${error.message}\n`);
  process.exit(1);
});

// Catch unhandled rejections that escape MCP SDK's error handling
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  process.stderr.write(`[recurrsive-mcp] Unhandled rejection: ${message}\n`);
  process.exit(1);
});

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[recurrsive-mcp] Fatal error: ${message}\n`);
  process.exit(1);
});
