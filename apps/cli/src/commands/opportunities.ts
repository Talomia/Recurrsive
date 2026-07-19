/**
 * @module @recurrsive/cli/commands/opportunities
 *
 * `recurrsive opportunities` — View and manage opportunities.
 *
 * Provides listing with filtering, detail view, accept/reject
 * workflow, and export capabilities.
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { OpportunityCategory, OpportunityStatus, Opportunity } from '@recurrsive/core';
import { OpportunityManager, type ExportFormat } from '@recurrsive/opportunities';
import { PolicyEngine, BUILTIN_POLICIES } from '@recurrsive/policy';
import { loadConfig } from '../config/loader.js';
import {
  header,
  success,
  error,
  warning,
  info,
  bold,
  cyan,
  dim,
  green,
  yellow,
  red,
  magenta,
  table,
  severityColor,
  severityBadge,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load the OpportunityManager from the saved opportunities file.
 *
 * Exported so other commands (e.g. `recurrsive policy check`) evaluate the
 * SAME persisted opportunity set instead of a freshly-constructed empty
 * manager.
 *
 * @param projectRoot - The project root directory.
 * @param outputDir - The .recurrsive output directory name.
 * @returns Loaded OpportunityManager or null if no data.
 */
export async function loadOpportunities(
  projectRoot: string,
  outputDir: string,
): Promise<OpportunityManager | null> {
  const filePath = join(projectRoot, outputDir, 'opportunities.json');

  if (!existsSync(filePath)) {
    return null;
  }

  const manager = new OpportunityManager();
  try {
    await manager.load(filePath);
    return manager;
  } catch {
    return null;
  }
}

/**
 * Save the OpportunityManager back to disk.
 *
 * @param manager - The manager to save.
 * @param projectRoot - The project root directory.
 * @param outputDir - The .recurrsive output directory name.
 */
async function saveOpportunities(
  manager: OpportunityManager,
  projectRoot: string,
  outputDir: string,
): Promise<void> {
  const filePath = join(projectRoot, outputDir, 'opportunities.json');
  await manager.save(filePath);
}

/**
 * Build the policy engine used by every CLI policy consumer: the built-in
 * policy sets plus any custom policy JSON files in
 * `<projectRoot>/<outputDir>/policies/`.
 *
 * Custom-policy load failures are surfaced as warnings and never widen the
 * effective policy surface: the built-ins always remain active (fail closed —
 * a broken custom file is skipped and reported, not silently loaded).
 *
 * @param projectRoot - The project root directory.
 * @param outputDir - The .recurrsive output directory name.
 * @returns A policy engine seeded with builtin + loaded policy sets.
 */
export async function buildPolicyEngine(
  projectRoot: string,
  outputDir: string,
): Promise<PolicyEngine> {
  const engine = new PolicyEngine(BUILTIN_POLICIES);
  const policyDir = join(projectRoot, outputDir, 'policies');
  if (existsSync(policyDir)) {
    try {
      const result = await engine.loadFromDirectory(policyDir);
      for (const err of result.errors) {
        warning(`Custom policy skipped: ${err}`);
      }
    } catch (err) {
      warning(
        `Failed to load custom policies from ${policyDir}: ` +
          `${err instanceof Error ? err.message : String(err)} (built-in policies remain active)`,
      );
    }
  }
  return engine;
}

/**
 * Format an opportunity for detailed display.
 *
 * @param opp - The opportunity to format.
 */
function printDetail(opp: Opportunity): void {
  console.log('');
  console.log(bold(`  ${opp.title}`));
  console.log(`  ${dim(opp.id)}`);
  console.log('');
  console.log(`  ${bold('Type:')}       ${opp.type}`);
  console.log(`  ${bold('Category:')}   ${opp.category}`);
  console.log(`  ${bold('Severity:')}   ${severityColor(opp.severity)}`);
  console.log(`  ${bold('Status:')}     ${formatStatus(opp.status)}`);
  console.log(
    `  ${bold('Confidence:')} ${Math.round(opp.confidence * 100)}%`,
  );
  console.log(`  ${bold('Effort:')}     ${opp.effort.t_shirt.toUpperCase()}`);
  console.log(`  ${bold('Risk:')}       ${opp.risk.level}`);
  console.log('');

  header('Problem');
  console.log(`  ${opp.problem}`);

  header('Recommendation');
  console.log(`  ${opp.recommendation}`);

  header('Expected Impact');
  console.log(`  ${opp.expected_impact.summary}`);
  if (opp.expected_impact.metrics.length > 0) {
    // Same measured-vs-estimate partition as the markdown exporter: a metric
    // is a genuine measured before/after ONLY when it carries a measured
    // current_value and is not flagged as an estimate. Everything else is a
    // projection and must be labelled as such — never rendered as a false
    // before/after.
    const isMeasured = (m: (typeof opp.expected_impact.metrics)[number]): boolean =>
      m.current_value !== undefined && m.current_value !== '' && m.is_estimate !== true;
    const measured = opp.expected_impact.metrics.filter(isMeasured);
    const estimates = opp.expected_impact.metrics.filter((m) => !isMeasured(m));

    if (measured.length > 0) {
      console.log('');
      console.log(`  ${bold('Measured metrics:')}`);
      for (const metric of measured) {
        // A change_percent of 0 is a legitimate value; only skip when absent.
        // Negative values keep their own sign — only positives get a '+'.
        const change = metric.change_percent !== undefined
          ? ` (${metric.change_percent > 0 ? '+' : ''}${metric.change_percent}%)`
          : '';
        console.log(`  • ${metric.name}: ${metric.current_value} → ${metric.expected_value ?? '?'}${change}`);
      }
    }

    if (estimates.length > 0) {
      console.log('');
      console.log(`  ${bold('Projected metrics')} ${dim('(estimates — not measured)')}:`);
      for (const metric of estimates) {
        const target = metric.expected_value !== undefined ? ` → ${metric.expected_value}` : '';
        const direction = metric.direction ? ` (${metric.direction})` : '';
        console.log(`  • ${metric.name} ${dim('(estimate)')}${target}${direction}`);
        if (metric.assumptions && metric.assumptions.length > 0) {
          for (const assumption of metric.assumptions) {
            console.log(`      ${dim(`assumes: ${assumption}`)}`);
          }
        }
      }
    }
  }
  if (opp.expected_impact.affected_services.length > 0) {
    console.log(`\n  ${bold('Affected services:')} ${opp.expected_impact.affected_services.join(', ')}`);
  }

  if (opp.evidence.length > 0) {
    header('Evidence');
    for (const ev of opp.evidence.slice(0, 5)) {
      console.log(`  ${dim('•')} [${ev.type}] ${ev.description}`);
      console.log(`    ${dim(`Source: ${ev.source} · Confidence: ${Math.round(ev.confidence * 100)}%`)}`);
    }
  }

  if (opp.locations.length > 0) {
    header('Locations');
    for (const loc of opp.locations.slice(0, 10)) {
      console.log(
        `  ${dim('→')} ${loc.file}${loc.start_line ? `:${loc.start_line}` : ''}`,
      );
    }
  }

  header('Risk Assessment');
  console.log(`  ${bold('Level:')} ${opp.risk.level}`);
  console.log(`  ${opp.risk.description}`);
  if (opp.risk.mitigations.length > 0) {
    console.log(`\n  ${bold('Mitigations:')}`);
    for (const m of opp.risk.mitigations) {
      console.log(`    • ${m}`);
    }
  }

  header('Validation Plan');
  if (opp.validation.steps.length > 0) {
    for (const s of opp.validation.steps) {
      console.log(`  ${dim('•')} [${s.type}] ${s.description}`);
    }
  }
  if (opp.validation.success_criteria.length > 0) {
    console.log(`\n  ${bold('Success criteria:')}`);
    for (const c of opp.validation.success_criteria) {
      console.log(`    ✓ ${c}`);
    }
  }

  if (opp.decision_reason) {
    header('Decision');
    console.log(`  ${opp.decision_reason}`);
  }

  console.log('');
}

/**
 * Format a status string with colour.
 *
 * @param status - Opportunity status.
 * @returns Coloured status string.
 */
function formatStatus(status: OpportunityStatus): string {
  switch (status) {
    case 'proposed':
      return yellow('PROPOSED');
    case 'accepted':
      return green('ACCEPTED');
    case 'rejected':
      return red('REJECTED');
    case 'in_progress':
      return cyan('IN PROGRESS');
    case 'implemented':
      return green('IMPLEMENTED');
    case 'validated':
      return bold(green('VALIDATED'));
    case 'archived':
      return dim('ARCHIVED');
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `opportunities` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerOpportunitiesCommand(program: Command): void {
  program
    .command('opportunities')
    .alias('opps')
    .description('View and manage opportunities')
    .option('--filter <category>', 'Filter by category')
    .option('--status <status>', 'Filter by status')
    .option('--top <n>', 'Show top N opportunities', parseInt)
    .option('--detail <id>', 'Show full detail for an opportunity')
    .option('--accept <id>', 'Accept an opportunity')
    .option('--reject <id>', 'Reject an opportunity')
    .option('--reason <reason>', 'Reason for accept/reject')
    .option(
      '--force',
      'Explicitly approve an accept that policy marks require_approval (recorded; does NOT bypass block)',
    )
    .option('--export <format>', 'Export to json/markdown/sarif')
    .option('--json', 'Output as JSON to stdout (for scripting)')
    .action(
      async (opts: {
        filter?: string;
        status?: string;
        top?: number;
        detail?: string;
        accept?: string;
        reject?: string;
        reason?: string;
        force?: boolean;
        export?: string;
        json?: boolean;
      }) => {
        // Load config and opportunities
        const { config, projectRoot } = await loadConfig();
        const manager = await loadOpportunities(projectRoot, config.output.directory);

        if (!manager || manager.count === 0) {
          // In --json mode emit a valid empty array so scripts can parse it,
          // and keep the human guidance off stdout.
          if (opts.json) {
            console.log('[]');
            return;
          }
          info('No opportunities found.');
          info(
            `Opportunities are generated by the reasoning engine during ${bold(cyan('recurrsive analyze'))}. ` +
              `Set ${bold('RECURRSIVE_LLM_API_KEY')} (or add ${bold('reasoning')} to config) before analyzing, ` +
              `or run ${bold(cyan('recurrsive report'))} to view raw findings.`,
          );
          return;
        }

        // ── Accept/Reject ──────────────────────────────────────────
        if (opts.accept) {
          try {
            // Policy gate: the accept transition must consult the policy
            // engine. A `block` verdict is final (even with --force);
            // `require_approval` demands an explicit --force, which is
            // recorded in the decision reason.
            let reason = opts.reason ?? 'Accepted via CLI';
            const target = manager.get(opts.accept);
            if (target) {
              const engine = await buildPolicyEngine(projectRoot, config.output.directory);
              const verdict = engine.passes(target);
              if (verdict.effectiveAction === 'block') {
                const detail = verdict.violations[0]?.message ?? 'a policy rule blocks this transition';
                error(
                  `Cannot accept "${target.title}": blocked by policy — ${detail}`,
                );
                process.exitCode = 1;
                return;
              }
              if (verdict.effectiveAction === 'require_approval') {
                if (!opts.force) {
                  const detail = verdict.violations[0]?.message ?? 'policy requires manual approval';
                  error(
                    `Cannot accept "${target.title}" without explicit approval — ${detail} ` +
                      `Re-run with --force to approve (the override is recorded).`,
                  );
                  process.exitCode = 1;
                  return;
                }
                reason = `${reason} [policy override: require_approval approved via --force]`;
              }
            }

            const opp = manager.updateStatus(opts.accept, 'accepted', reason);
            await saveOpportunities(manager, projectRoot, config.output.directory);
            success(`Accepted: ${bold(opp.title)}`);
          } catch (err: unknown) {
            error(err instanceof Error ? err.message : String(err));
          }
          return;
        }

        if (opts.reject) {
          try {
            const opp = manager.updateStatus(
              opts.reject,
              'rejected',
              opts.reason ?? 'Rejected via CLI',
            );
            await saveOpportunities(manager, projectRoot, config.output.directory);
            success(`Rejected: ${bold(opp.title)}`);
          } catch (err: unknown) {
            error(err instanceof Error ? err.message : String(err));
          }
          return;
        }

        // ── Detail View ──────────────────────────────────────────
        if (opts.detail) {
          let resolved = manager.get(opts.detail);
          if (!resolved) {
            // Try partial match on ID prefix or title substring.
            const all = manager.list();
            resolved = all.find(
              (o) =>
                o.id.startsWith(opts.detail!) ||
                o.title.toLowerCase().includes(opts.detail!.toLowerCase()),
            );
          }
          if (!resolved) {
            error(`Opportunity not found: ${opts.detail}`);
            return;
          }
          if (opts.json) {
            console.log(JSON.stringify(resolved, null, 2));
          } else {
            printDetail(resolved);
          }
          return;
        }

        // ── Export ────────────────────────────────────────────────
        if (opts.export) {
          const format = opts.export as ExportFormat;
          if (!['json', 'markdown', 'sarif'].includes(format)) {
            error(`Unsupported export format: ${format}. Use json, markdown, or sarif.`);
            return;
          }

          const content = manager.export(format);
          const ext = format === 'json' ? 'json' : format === 'sarif' ? 'sarif.json' : 'md';
          const outputPath = join(
            projectRoot,
            config.output.directory,
            'reports',
            `opportunities.${ext}`,
          );

          await writeFile(outputPath, content, 'utf-8');
          success(`Exported to ${dim(outputPath)}`);
          return;
        }

        // ── List ─────────────────────────────────────────────────
        const filters: {
          category?: OpportunityCategory;
          status?: OpportunityStatus;
        } = {};

        if (opts.filter) {
          filters.category = opts.filter as OpportunityCategory;
        }
        if (opts.status) {
          filters.status = opts.status as OpportunityStatus;
        }

        let opportunities = manager.list(filters);

        if (opts.top) {
          opportunities = opportunities.slice(0, opts.top);
        }

        // --json short-circuits before any human formatting so stdout is
        // pure, parseable JSON (an empty array when nothing matches).
        if (opts.json) {
          console.log(JSON.stringify(opportunities, null, 2));
          return;
        }

        header('Opportunities');

        if (opportunities.length === 0) {
          info('No opportunities match the current filters.');
          return;
        }

        // Summary counts
        const byType = new Map<string, number>();
        const bySeverity = new Map<string, number>();
        for (const opp of manager.list()) {
          byType.set(opp.type, (byType.get(opp.type) ?? 0) + 1);
          bySeverity.set(opp.severity, (bySeverity.get(opp.severity) ?? 0) + 1);
        }

        console.log(
          `  ${bold('Total:')} ${manager.count}  │  ` +
            `${magenta('opportunities:')} ${byType.get('opportunity') ?? 0}  │  ` +
            `${red('risks:')} ${byType.get('risk') ?? 0}  │  ` +
            `${yellow('debt:')} ${byType.get('debt') ?? 0}`,
        );
        console.log('');

        // Table view
        const rows = opportunities.map((opp) => [
          severityBadge(opp.severity),
          opp.title.slice(0, 50) + (opp.title.length > 50 ? '…' : ''),
          opp.category,
          opp.type,
          formatStatus(opp.status),
          `${Math.round(opp.confidence * 100)}%`,
          opp.id.slice(0, 8),
        ]);

        console.log(
          table(
            ['', 'Title', 'Category', 'Type', 'Status', 'Conf', 'ID'],
            rows,
          ),
        );
        console.log('');

        console.log(
          dim('  Use ') +
            cyan(`recurrsive opportunities --detail <id>`) +
            dim(' for full details.'),
        );
        console.log(
          dim('  Use ') +
            cyan(`recurrsive opportunities --accept <id>`) +
            dim(' to accept an opportunity.'),
        );
        console.log('');
      },
    );
}
