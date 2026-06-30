/**
 * @module @recurrsive/cli
 *
 * Main CLI program setup for the Recurrsive Engineering Intelligence Platform.
 *
 * Creates a Commander.js program with all registered commands:
 * - `init` — Initialize Recurrsive in a project
 * - `analyze` — Run the full analysis pipeline
 * - `opportunities` — View and manage opportunities
 * - `graph` — Explore the knowledge graph
 * - `timeline` — Show evolution over time
 * - `health` — Show project health score
 * - `report` — Generate reports from analysis results
 * - `config` — View, validate, and inspect configuration
 *
 * @packageDocumentation
 */

import { Command } from 'commander';
import {
  registerInitCommand,
  registerAnalyzeCommand,
  registerOpportunitiesCommand,
  registerGraphCommand,
  registerTimelineCommand,
  registerHealthCommand,
  registerReportCommand,
  registerConfigCommand,
} from './commands/index.js';

/**
 * Create the Recurrsive CLI program with all commands registered.
 *
 * @returns A configured Commander.js {@link Command} instance.
 *
 * @example
 * ```ts
 * import { createProgram } from '@recurrsive/cli';
 *
 * const program = createProgram();
 * await program.parseAsync(process.argv);
 * ```
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('recurrsive')
    .description('Engineering Intelligence Platform')
    .version('0.1.0');

  // Register all commands
  registerInitCommand(program);
  registerAnalyzeCommand(program);
  registerOpportunitiesCommand(program);
  registerGraphCommand(program);
  registerTimelineCommand(program);
  registerHealthCommand(program);
  registerReportCommand(program);
  registerConfigCommand(program);

  return program;
}
