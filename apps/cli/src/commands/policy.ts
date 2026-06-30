/**
 * @module @recurrsive/cli/commands/policy
 *
 * `recurrsive policy` — Policy compliance check for opportunities.
 *
 * Evaluates opportunities against built-in and custom policy rules,
 * displaying compliance rates and violations.
 *
 * @packageDocumentation
 */

import { resolve } from 'node:path';
import type { Command } from 'commander';
import {
  createGraphClient,
  type ExtendedGraphClient,
} from '@recurrsive/graph';
import { OpportunityManager } from '@recurrsive/opportunities';
import { PolicyEngine, BUILTIN_POLICIES } from '@recurrsive/policy';
import { loadConfig } from '../config/loader.js';
import {
  banner,
  header,
  error,
  info,
  bold,
  cyan,
  green,
  yellow,
  red,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a graph client from current config.
 *
 * @returns Graph client and project root.
 */
async function getGraphClient(): Promise<{
  client: ExtendedGraphClient;
  projectRoot: string;
}> {
  const { config, projectRoot } = await loadConfig();
  const dbPath =
    config.graph.connection_string ??
    resolve(projectRoot, '.recurrsive', 'graph.db');

  const client = await createGraphClient({
    provider: config.graph.provider,
    sqlitePath: config.graph.provider === 'sqlite' ? dbPath : undefined,
    connectionString:
      config.graph.provider === 'postgresql_age'
        ? config.graph.connection_string
        : undefined,
    autoMigrate: false,
  });

  return { client, projectRoot };
}

/**
 * Color a compliance rate based on value.
 */
function complianceColor(rate: number): string {
  if (rate >= 90) return green(`${rate}%`);
  if (rate >= 70) return yellow(`${rate}%`);
  return red(`${rate}%`);
}

/**
 * Color an action string.
 */
function actionColor(action: string): string {
  switch (action) {
    case 'block':
      return red(action);
    case 'require_approval':
      return yellow(action);
    case 'warn':
      return yellow(action);
    case 'allow':
      return green(action);
    default:
      return action;
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `policy` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerPolicyCommand(program: Command): void {
  const policy = program
    .command('policy')
    .description('Evaluate policy compliance for opportunities');

  // ── policy check ────────────────────────────────────────────────────
  policy
    .command('check')
    .description('Run policy checks against all opportunities')
    .option('--json', 'Output results as JSON')
    .action(async (options: { json?: boolean }) => {
      banner();
      let client: ExtendedGraphClient | null = null;

      try {
        const { client: graphClient } = await getGraphClient();
        client = graphClient;

        // Load opportunities from graph
        const manager = new OpportunityManager();
        const opportunities = manager.list();

        // Create policy engine with built-in policies
        const engine = new PolicyEngine(BUILTIN_POLICIES);
        const policies = engine.getPolicies();

        // Evaluate each opportunity
        const results = opportunities.map((opp) => {
          const result = engine.passes(opp);
          return {
            id: opp.id,
            title: opp.title,
            severity: opp.severity,
            passed: result.passed,
            action: result.effectiveAction,
            violations: result.violations.length,
            warnings: result.warnings.length,
          };
        });

        if (options.json) {
          const passed = results.filter((r) => r.passed).length;
          console.log(JSON.stringify({
            summary: {
              total: results.length,
              passed,
              compliance_rate: results.length > 0
                ? Math.round((passed / results.length) * 100)
                : 100,
              policy_sets: policies.length,
            },
            results,
          }, null, 2));
          return;
        }

        header('Policy Compliance Check');

        // Show active policies
        info(`${bold('Active Policy Sets')}: ${cyan(String(policies.length))}`);
        for (const ps of policies) {
          info(`  ${bold(ps.name)} ${dim(`(${ps.rules.length} rules)`)}`);
        }
        console.log();

        if (opportunities.length === 0) {
          info('No opportunities to evaluate. Run `recurrsive analyze` first.');
          return;
        }

        // Show results table
        const headers = ['Title', 'Severity', 'Status', 'Action', 'Violations', 'Warnings'];
        const rows = results.map((r) => [
          r.title.length > 40 ? r.title.slice(0, 40) + '…' : r.title,
          r.severity,
          r.passed ? green('✓ Pass') : red('✗ Fail'),
          actionColor(r.action),
          r.violations > 0 ? red(String(r.violations)) : dim('0'),
          r.warnings > 0 ? yellow(String(r.warnings)) : dim('0'),
        ]);

        console.log(table(headers, rows));

        // Summary
        console.log();
        const passed = results.filter((r) => r.passed).length;
        const blocked = results.filter((r) => r.action === 'block').length;
        const rate = results.length > 0
          ? Math.round((passed / results.length) * 100)
          : 100;

        info(`${bold('Compliance Rate')}: ${complianceColor(rate)}`);
        info(`${bold('Total')}: ${results.length}  ` +
          `${bold('Passed')}: ${green(String(passed))}  ` +
          `${bold('Blocked')}: ${blocked > 0 ? red(String(blocked)) : dim('0')}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(`Policy check failed: ${msg}`);
        process.exitCode = 1;
      } finally {
        if (client && 'dispose' in client) {
          await (client as unknown as { dispose(): Promise<void> }).dispose();
        }
      }
    });

  // ── policy list ─────────────────────────────────────────────────────
  policy
    .command('list')
    .description('List all active policy sets and their rules')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      banner();

      const engine = new PolicyEngine(BUILTIN_POLICIES);
      const policies = engine.getPolicies();

      if (options.json) {
        console.log(JSON.stringify(policies, null, 2));
        return;
      }

      header('Active Policy Sets');
      info(`${bold('Total')}: ${cyan(String(policies.length))} policy sets\n`);

      for (const ps of policies) {
        info(`${bold(cyan(ps.name))} ${dim(`[${ps.id}]`)}`);
        info(`  ${ps.description}`);
        info(`  ${bold('Rules')}: ${ps.rules.length}`);

        const ruleHeaders = ['Name', 'Scope', 'Action', 'Condition'];
        const ruleRows = ps.rules.map((r) => [
          r.name,
          r.scope,
          actionColor(r.action),
          r.condition.length > 50
            ? r.condition.slice(0, 50) + '…'
            : r.condition,
        ]);

        console.log(table(ruleHeaders, ruleRows));
        console.log();
      }
    });
}
