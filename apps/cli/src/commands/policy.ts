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

import type { Command } from 'commander';
import { PolicyEngine, BUILTIN_POLICIES } from '@recurrsive/policy';
import { loadConfig } from '../config/loader.js';
import { loadOpportunities, buildPolicyEngine } from './opportunities.js';
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

      try {
        const { config, projectRoot } = await loadConfig();

        // Load the REAL persisted opportunity set (same file the
        // `opportunities` command manages). A missing/empty file means
        // there is genuinely nothing to evaluate — which is reported as
        // "not evaluated", never as 100% compliance.
        const manager = await loadOpportunities(projectRoot, config.output.directory);
        const opportunities = manager?.list() ?? [];

        // Builtin + custom-loaded policies — same engine construction as
        // the accept workflow.
        const engine = await buildPolicyEngine(projectRoot, config.output.directory);
        const policies = engine.getPolicies();

        // Evaluate each opportunity with the engine's three-state verdict.
        // `passed` is true ONLY for fully compliant items — an item that
        // needs approval is NOT compliant.
        const results = opportunities.map((opp) => {
          const result = engine.passes(opp);
          return {
            id: opp.id,
            title: opp.title,
            severity: opp.severity,
            passed: result.passed,
            compliance: result.compliance,
            action: result.effectiveAction,
            violations: result.violations.length,
            warnings: result.warnings.length,
          };
        });

        const total = results.length;
        const compliant = results.filter((r) => r.compliance === 'compliant').length;
        const needsApproval = results.filter((r) => r.compliance === 'needs_approval').length;
        const blocked = results.filter((r) => r.compliance === 'blocked').length;
        // With zero opportunities there is nothing to be compliant WITH —
        // the rate is null/not_evaluated, never a fabricated 100.
        const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : null;

        if (options.json) {
          console.log(JSON.stringify({
            summary: {
              total,
              passed: compliant,
              compliant,
              needs_approval: needsApproval,
              blocked,
              compliance_rate: complianceRate,
              status: total > 0 ? 'evaluated' : 'not_evaluated',
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
          info(`${bold('Compliance Rate')}: ${dim('not evaluated (no opportunities)')}`);
          return;
        }

        // Show results table
        const headers = ['Title', 'Severity', 'Compliance', 'Action', 'Violations', 'Warnings'];
        const rows = results.map((r) => [
          r.title.length > 40 ? r.title.slice(0, 40) + '…' : r.title,
          r.severity,
          r.compliance === 'compliant'
            ? green('✓ Compliant')
            : r.compliance === 'needs_approval'
              ? yellow('⚠ Needs approval')
              : red('✗ Blocked'),
          actionColor(r.action),
          r.violations > 0 ? red(String(r.violations)) : dim('0'),
          r.warnings > 0 ? yellow(String(r.warnings)) : dim('0'),
        ]);

        console.log(table(headers, rows));

        // Summary
        console.log();
        info(`${bold('Compliance Rate')}: ${complianceColor(complianceRate!)}`);
        info(`${bold('Total')}: ${total}  ` +
          `${bold('Compliant')}: ${green(String(compliant))}  ` +
          `${bold('Needs approval')}: ${needsApproval > 0 ? yellow(String(needsApproval)) : dim('0')}  ` +
          `${bold('Blocked')}: ${blocked > 0 ? red(String(blocked)) : dim('0')}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(`Policy check failed: ${msg}`);
        process.exitCode = 1;
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
