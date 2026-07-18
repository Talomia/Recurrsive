/**
 * @module @recurrsive/cli
 *
 * Main CLI program setup for the Recurrsive Engineering Intelligence Platform.
 *
 * Creates a Commander.js program with all registered commands, a friendly
 * first-run overview (shown when `recurrsive` is invoked with no arguments),
 * and a grouped `--help` reference with a clear getting-started path.
 *
 * Commands, grouped by how they are typically used:
 *
 * **Getting started**
 * - `init` — Initialize Recurrsive in a project
 * - `analyze` — Run the full local analysis pipeline
 * - `setup` — Create the first admin user on a server (first-run bootstrap)
 * - `login` / `logout` / `whoami` — Authenticate with a Recurrsive server
 *
 * **Explore results (local, no server required)**
 * - `opportunities` — View and manage prioritized opportunities
 * - `health` — Show project health score and maturity breakdown
 * - `report` — Generate a shareable report from the latest analysis
 * - `graph` — Explore the knowledge graph
 * - `search` — Full-text search the knowledge graph
 * - `timeline` — Show the intelligence timeline
 * - `snapshot` — Export and import knowledge graph snapshots
 * - `config` — View, validate, and inspect configuration
 * - `policy` — Policy compliance checks
 *
 * **Server & platform (require `login`)**
 * - `projects` — Multi-project management and comparison
 * - `analytics` — Analytics summaries and categories
 * - `comparisons` — Compare analysis runs side-by-side
 * - `experiments` — Manage analysis experiments
 * - `forecast` — Health forecasting and what-if analysis
 * - `batch` — Run batch analysis on multiple projects
 * - `simulate` — Simulation engine
 * - `cloud` — Cloud benchmarks and patterns
 * - `plugins` — Plugin marketplace and management
 * - `webhooks` — Manage webhook integrations
 * - `notifications` — Manage notification channels
 * - `secrets` — Secret rotation and audit
 * - `audit` — View and search the audit trail
 * - `export` — Export analysis data
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
import { registerPluginsCommand } from './commands/plugins.js';
import { registerSecretsCommand } from './commands/secrets.js';
import { registerSimulationCommand } from './commands/simulation.js';
import { registerCloudCommand } from './commands/cloud.js';
import { registerLoginCommand } from './commands/login.js';
import { banner, bold, cyan, dim, green } from './output/terminal.js';

/**
 * A curated group of commands shown in the first-run overview.
 */
interface CommandGroup {
  title: string;
  commands: Array<{ name: string; summary: string }>;
}

/**
 * Curated command groups for the friendly overview. This is intentionally a
 * short, orienting subset — the exhaustive list lives in `--help`.
 */
const OVERVIEW_GROUPS: CommandGroup[] = [
  {
    title: 'Get started',
    commands: [
      { name: 'init', summary: 'Set up Recurrsive in the current project' },
      { name: 'analyze', summary: 'Build the knowledge graph and surface findings' },
    ],
  },
  {
    title: 'Explore results (local)',
    commands: [
      { name: 'opportunities', summary: 'Review prioritized improvements' },
      { name: 'health', summary: 'Project health score and maturity' },
      { name: 'report', summary: 'Generate a shareable report' },
      { name: 'graph', summary: 'Explore the knowledge graph' },
    ],
  },
  {
    title: 'Connect a server',
    commands: [
      { name: 'setup', summary: 'Create the first admin user (first run)' },
      { name: 'login', summary: 'Authenticate to unlock projects, analytics, forecasting' },
    ],
  },
];

/**
 * Print the friendly first-run overview: what Recurrsive is, the
 * getting-started path, and a curated set of commands. Shown when the CLI is
 * invoked with no subcommand.
 */
export function printOverview(): void {
  banner();

  console.log(
    `  ${dim('Turn your codebase into a queryable knowledge graph, surface')}`,
  );
  console.log(
    `  ${dim('risks and opportunities, and track engineering health over time.')}`,
  );
  console.log('');

  for (const group of OVERVIEW_GROUPS) {
    console.log(`  ${bold(group.title)}`);
    const width = Math.max(...group.commands.map((c) => c.name.length));
    for (const cmd of group.commands) {
      console.log(
        `    ${cyan(cmd.name.padEnd(width))}   ${dim(cmd.summary)}`,
      );
    }
    console.log('');
  }

  console.log(`  ${bold('First time?')} Follow the path:`);
  console.log(
    `    ${green('1.')} ${cyan('recurrsive init')}     ${dim('· initialize this project')}`,
  );
  console.log(
    `    ${green('2.')} ${cyan('recurrsive analyze')}  ${dim('· run the analysis pipeline')}`,
  );
  console.log(
    `    ${green('3.')} ${cyan('recurrsive opportunities')} ${dim('· review what to improve')}`,
  );
  console.log('');
  console.log(
    `  ${dim('Run')} ${cyan('recurrsive <command> --help')} ${dim('for details, or')} ${cyan('recurrsive --help')} ${dim('for the full command list.')}`,
  );
  console.log('');
}

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
    .description(
      'Engineering Intelligence Platform — analyze your codebase, build a\n' +
        'knowledge graph, and surface prioritized risks and opportunities.',
    )
    .version(VERSION, '-v, --version', 'Show the installed version')
    // Global project scope for all server-backed commands. The value is
    // surfaced through RECURRSIVE_PROJECT so the shared apiRequest helper can
    // append ?projectId= without threading the option through every command.
    .option(
      '-p, --project <id>',
      'Scope server commands to a project (overrides `recurrsive projects use`)',
    )
    .hook('preAction', (thisCommand) => {
      const project = thisCommand.opts()['project'] as string | undefined;
      if (project) process.env['RECURRSIVE_PROJECT'] = project;
    })
    // Sort subcommands and options alphabetically in --help for scannability.
    .configureHelp({ sortSubcommands: true, sortOptions: true })
    // On an unknown command / bad flag, point the user at --help instead of
    // failing silently.
    .showHelpAfterError('(run `recurrsive --help` to see available commands)')
    .showSuggestionAfterError(true);

  // Getting-started examples and pointers appended to `--help` output.
  program.addHelpText(
    'afterAll',
    [
      '',
      bold('Getting started:'),
      `  ${green('1.')} ${cyan('recurrsive init')}            Initialize Recurrsive in the current project`,
      `  ${green('2.')} ${cyan('recurrsive analyze')}         Build the graph and run analyzers`,
      `  ${green('3.')} ${cyan('recurrsive opportunities')}   Review prioritized improvements`,
      `     ${dim('(or')} ${cyan('recurrsive report')} ${dim('to generate a shareable report)')}`,
      `  ${green('4.')} ${cyan('recurrsive health')}          Track maturity over time`,
      '',
      bold('Server & platform features') + dim(' (projects, analytics, forecasting):'),
      `  First run:   ${cyan('recurrsive setup')}   ${dim('· create the first admin user')}`,
      `  Otherwise:   ${cyan('recurrsive login')}   ${dim('· authenticate, then e.g.')} ${cyan('recurrsive projects list')}`,
      '',
      bold('Tips:'),
      `  ${dim('•')} Many commands accept ${cyan('--json')} for scripting ${dim('(')}${cyan('analyze')}${dim('/')}${cyan('report')} ${dim('use')} ${cyan('--format json')}${dim(').')}`,
      `  ${dim('•')} Set ${cyan('RECURRSIVE_LLM_API_KEY')} before ${cyan('analyze')} to generate opportunities via reasoning.`,
      `  ${dim('•')} Point at a server with ${cyan('RECURRSIVE_SERVER')} ${dim('or')} ${cyan('login --server <url>')} ${dim('(default http://localhost:3000)')}.`,
      `  ${dim('•')} Scope server commands to a project: ${cyan('recurrsive projects use <id>')} ${dim('or the global')} ${cyan('--project <id>')}${dim('.')}`,
      '',
    ].join('\n'),
  );

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
  registerPluginsCommand(program);
  registerSecretsCommand(program);
  registerSimulationCommand(program);
  registerCloudCommand(program);
  registerLoginCommand(program);

  return program;
}
