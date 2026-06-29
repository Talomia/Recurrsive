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

import { createProgram } from './index.js';
import { bold, red, dim } from './output/terminal.js';

async function main(): Promise<void> {
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
