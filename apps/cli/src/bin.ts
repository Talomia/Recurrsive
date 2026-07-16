#!/usr/bin/env node
/**
 * @module @recurrsive/cli/bin
 *
 * Entry point for the `recurrsive` CLI executable.
 *
 * This shebang-prefixed module imports the Commander program from
 * `./index.js`, wires up top-level error handling, and invokes
 * `parseAsync` on `process.argv`.
 *
 * @packageDocumentation
 */

import { createProgram, printOverview } from './index.js';
import { bold, red, dim } from './output/terminal.js';

// Catch unhandled rejections that escape Commander's error handling
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  process.stderr.write(`\n${red(bold('✖ Unhandled rejection:'))} ${message}\n`);
  process.exit(1);
});

async function main(): Promise<void> {
  // With no subcommand or flags at all, show the friendly first-run overview
  // (what the tool is + a getting-started path) instead of Commander's terse
  // default help. Explicit `recurrsive --help` still shows the full reference,
  // and an unknown command still errors with a suggestion.
  if (process.argv.slice(2).length === 0) {
    printOverview();
    return;
  }

  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    process.stderr.write(`\n${red(bold('✖ Fatal error:'))} ${message}\n`);
    if (stack) {
      process.stderr.write(`${dim(stack)}\n`);
    }
    process.exit(1);
  }
}

main();
