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
import { loadConfig } from '../config/loader.js';
import {
  header,
  success,
  error,
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
 * @param projectRoot - The project root directory.
 * @param outputDir - The .recurrsive output directory name.
 * @returns Loaded OpportunityManager or null if no data.
 */
async function loadOpportunities(
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
    console.log('');
    for (const metric of opp.expected_impact.metrics) {
      const change = metric.change_percent
        ? ` (${metric.direction === 'decrease' ? '' : '+'}${metric.change_percent}%)`
        : '';
      console.log(`  • ${metric.name}: ${metric.current_value ?? '?'} → ${metric.expected_value ?? '?'}${change}`);
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
            const opp = manager.updateStatus(
              opts.accept,
              'accepted',
              opts.reason ?? 'Accepted via CLI',
            );
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
