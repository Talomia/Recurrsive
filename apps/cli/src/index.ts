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
 * - `timeline` — Show intelligence timeline
 * - `health` — Show project health score
 * - `report` — Generate reports from analysis results
 * - `config` — View, validate, and inspect configuration
 * - `search` — Full-text search the knowledge graph
 * - `snapshot` — Export and import knowledge graph snapshots
 * - `policy` — Policy compliance checks
 * - `webhooks` — Manage webhook integrations
 * - `notifications` — Manage notification channels
 * - `batch` — Run batch analysis on multiple projects
 * - `audit` — View and search the audit trail
 * - `analytics` — View analytics summaries and categories
 * - `experiments` — Manage analysis experiments
 * - `comparisons` — Compare analysis runs side-by-side
 * - `export` — Export analysis data
 * - `projects` — Multi-project management
 * - `forecast` — History-based health trend projection
 * - `secrets` — Secret rotation and audit
 * - `login` — Authenticate with the server
 * - `logout` — Remove saved credentials
 * - `whoami` — Show current user
 *
 * @packageDocumentation
 */

import { Command } from 'commander';
import { VERSION } from '@recurrsive/core';
import {
  registerInitCommand,
  registerAnalyzeCommand,
  registerOpportunitiesCommand,
  registerGraphCommand,
  registerTimelineCommand,
  registerHealthCommand,
  registerReportCommand,
  registerConfigCommand,
  registerSearchCommand,
  registerSnapshotCommand,
  registerPolicyCommand,
  registerWebhooksCommand,
} from './commands/index.js';
import { registerNotificationsCommand } from './commands/notifications.js';
import { registerBatchCommand } from './commands/batch.js';
import { registerAuditCommand } from './commands/audit.js';
import { registerAnalyticsCommand } from './commands/analytics.js';
import { registerExperimentsCommand } from './commands/experiments.js';
import { registerComparisonsCommand } from './commands/comparisons.js';
import { registerExportCommand } from './commands/export.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerForecastCommand } from './commands/forecasting.js';
import { registerSecretsCommand } from './commands/secrets.js';
import { registerLoginCommand } from './commands/login.js';

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
    .version(VERSION);

  // Register all commands
  registerInitCommand(program);
  registerAnalyzeCommand(program);
  registerOpportunitiesCommand(program);
  registerGraphCommand(program);
  registerTimelineCommand(program);
  registerHealthCommand(program);
  registerReportCommand(program);
  registerConfigCommand(program);
  registerSearchCommand(program);
  registerSnapshotCommand(program);
  registerPolicyCommand(program);
  registerWebhooksCommand(program);
  registerNotificationsCommand(program);
  registerBatchCommand(program);
  registerAuditCommand(program);
  registerAnalyticsCommand(program);
  registerExperimentsCommand(program);
  registerComparisonsCommand(program);
  registerExportCommand(program);
  registerProjectsCommand(program);
  registerForecastCommand(program);
  registerSecretsCommand(program);
  registerLoginCommand(program);

  return program;
}
