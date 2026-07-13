/**
 * @module @recurrsive/presentation/formatters/terminal
 *
 * Terminal output formatters with ANSI escape code colouring.
 *
 * @packageDocumentation
 */

import type { Opportunity, Severity, MaturityScore, MaturityLevel } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// ANSI colour constants
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const UNDERLINE = '\x1b[4m';

const FG_RED = '\x1b[31m';
const FG_GREEN = '\x1b[32m';
const FG_YELLOW = '\x1b[33m';
const FG_BLUE = '\x1b[34m';
const FG_CYAN = '\x1b[36m';
const FG_WHITE = '\x1b[37m';

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: FG_RED,
  high: FG_YELLOW,
  medium: FG_CYAN,
  low: FG_GREEN,
  info: DIM,
};

const SEVERITY_ICON: Record<Severity, string> = {
  critical: '✘',
  high: '⚠',
  medium: '●',
  low: '✔',
  info: 'ⓘ',
};

// ---------------------------------------------------------------------------
// Table formatting
// ---------------------------------------------------------------------------

/**
 * Format an aligned table with borders from headers and row data.
 *
 * @param headers - Column header strings
 * @param rows - Array of row arrays (each row has same length as headers)
 * @returns Formatted table string with box-drawing borders
 */
export function formatTable(headers: string[], rows: string[][]): string {
  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const dataMax = rows.reduce(
      (max, row) => Math.max(max, stripAnsi(row[i] ?? '').length),
      0,
    );
    return Math.max(stripAnsi(h).length, dataMax);
  });

  const pad = (str: string, width: number): string => {
    const visible = stripAnsi(str).length;
    const diff = width - visible;
    return str + ' '.repeat(Math.max(0, diff));
  };

  const topBorder = '┌' + colWidths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐';
  const midBorder = '├' + colWidths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤';
  const botBorder = '└' + colWidths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘';

  const headerRow =
    '│ ' + headers.map((h, i) => `${BOLD}${pad(h, colWidths[i]!)}${RESET}`).join(' │ ') + ' │';

  const dataRows = rows.map(
    (row) =>
      '│ ' + row.map((cell, i) => pad(cell, colWidths[i]!)).join(' │ ') + ' │',
  );

  return [topBorder, headerRow, midBorder, ...dataRows, botBorder].join('\n');
}

/**
 * Strip ANSI escape codes from a string for length calculation.
 *
 * @param str - String potentially containing ANSI codes
 * @returns Clean string without ANSI codes
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

/**
 * Format an ASCII progress bar.
 *
 * @param current - Current progress value
 * @param total - Total value (100%)
 * @param width - Character width of the bar (default: 40)
 * @returns Formatted progress bar string with percentage
 *
 * @example
 * ```
 * formatProgressBar(7, 10, 20)
 * // "█████████████░░░░░░░  70%"
 * ```
 */
export function formatProgressBar(current: number, total: number, width: number = 40): string {
  const ratio = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const pct = Math.round(ratio * 100);

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const color = pct >= 75 ? FG_GREEN : pct >= 50 ? FG_YELLOW : FG_RED;

  return `${color}${bar}${RESET} ${BOLD}${pct}%${RESET}`;
}

// ---------------------------------------------------------------------------
// Opportunity formatters
// ---------------------------------------------------------------------------

/**
 * Format an array of opportunities as a table view.
 *
 * Columns: Severity, Title, Category, Confidence, Effort
 *
 * @param opps - Opportunities to display
 * @returns Formatted terminal table string
 */
export function formatOpportunities(opps: readonly Opportunity[]): string {
  if (opps.length === 0) {
    return `${DIM}No opportunities to display.${RESET}`;
  }

  const headers = ['Severity', 'Title', 'Category', 'Confidence', 'Effort'];

  const rows = opps.map((opp) => {
    const color = SEVERITY_COLOR[opp.severity];
    const icon = SEVERITY_ICON[opp.severity];
    return [
      `${color}${icon} ${opp.severity}${RESET}`,
      opp.title.length > 50 ? opp.title.slice(0, 47) + '...' : opp.title,
      opp.category,
      `${Math.round(opp.confidence * 100)}%`,
      opp.effort.t_shirt.toUpperCase(),
    ];
  });

  return formatTable(headers, rows);
}

/**
 * Format a single opportunity with full detail.
 *
 * @param opp - The opportunity to display
 * @returns Formatted detail view string
 */
export function formatOpportunityDetail(opp: Opportunity): string {
  const color = SEVERITY_COLOR[opp.severity];
  const icon = SEVERITY_ICON[opp.severity];
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${color}${icon} ${BOLD}${opp.title}${RESET}`);
  lines.push(`${'─'.repeat(60)}`);

  // Key fields
  const fields: Array<[string, string]> = [
    ['ID', opp.id],
    ['Type', opp.type],
    ['Category', opp.category],
    ['Severity', `${color}${opp.severity}${RESET}`],
    ['Status', opp.status],
    ['Confidence', `${Math.round(opp.confidence * 100)}%`],
    ['Effort', `${opp.effort.t_shirt.toUpperCase()}${opp.effort.estimated_hours ? ` (${opp.effort.estimated_hours}h)` : ''}`],
    ['Risk', opp.risk.level],
    ['Created', opp.created_at],
  ];

  const maxLabel = Math.max(...fields.map(([label]) => label.length));
  for (const [label, value] of fields) {
    lines.push(`  ${DIM}${label.padEnd(maxLabel)}${RESET}  ${value}`);
  }

  // Problem
  lines.push('');
  lines.push(`  ${BOLD}${UNDERLINE}Problem${RESET}`);
  lines.push(`  ${opp.problem}`);

  // Recommendation
  lines.push('');
  lines.push(`  ${BOLD}${UNDERLINE}Recommendation${RESET}`);
  lines.push(`  ${opp.recommendation}`);

  // Impact
  lines.push('');
  lines.push(`  ${BOLD}${UNDERLINE}Expected Impact${RESET}`);
  lines.push(`  ${opp.expected_impact.summary}`);
  if (opp.expected_impact.metrics.length > 0) {
    const metricHeaders = ['Metric', 'Current', 'Expected', 'Change'];
    const metricRows = opp.expected_impact.metrics.map((m) => [
      m.name,
      m.current_value?.toString() ?? '—',
      m.expected_value?.toString() ?? '—',
      m.change_percent !== undefined
        ? `${m.change_percent > 0 ? '+' : ''}${m.change_percent}%`
        : '—',
    ]);
    lines.push('');
    // Indent table lines
    const table = formatTable(metricHeaders, metricRows);
    for (const line of table.split('\n')) {
      lines.push(`  ${line}`);
    }
  }

  // Evidence
  if (opp.evidence.length > 0) {
    lines.push('');
    lines.push(`  ${BOLD}${UNDERLINE}Evidence (${opp.evidence.length})${RESET}`);
    for (const e of opp.evidence) {
      lines.push(`  ${FG_BLUE}▸${RESET} [${e.type}] ${e.description.slice(0, 100)}${e.description.length > 100 ? '…' : ''} ${DIM}(${Math.round(e.confidence * 100)}%)${RESET}`);
    }
  }

  // Locations
  if (opp.locations.length > 0) {
    lines.push('');
    lines.push(`  ${BOLD}${UNDERLINE}Locations${RESET}`);
    for (const loc of opp.locations) {
      const lineRange =
        loc.start_line !== undefined
          ? `:${loc.start_line}${loc.end_line !== undefined ? `-${loc.end_line}` : ''}`
          : '';
      lines.push(`  ${FG_CYAN}→${RESET} ${loc.file}${lineRange}`);
    }
  }

  // Validation plan
  if (opp.validation.steps.length > 0) {
    lines.push('');
    lines.push(`  ${BOLD}${UNDERLINE}Validation Plan${RESET}`);
    for (const step of opp.validation.steps) {
      const duration = step.duration ? ` ${DIM}(${step.duration})${RESET}` : '';
      lines.push(`  ${FG_GREEN}◎${RESET} [${step.type}] ${step.description}${duration}`);
    }
    if (opp.validation.success_criteria.length > 0) {
      lines.push(`  ${DIM}Success criteria:${RESET}`);
      for (const c of opp.validation.success_criteria) {
        lines.push(`    ☐ ${c}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Health score formatter
// ---------------------------------------------------------------------------

/**
 * Format a health score dashboard for the terminal.
 *
 * @param score - Health score 0–100
 * @param maturity - Optional maturity scores to display alongside
 * @returns Formatted health dashboard string
 */
export function formatHealthScore(score: number, maturity?: MaturityScore[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${BOLD}╔══════════════════════════════════════╗${RESET}`);
  lines.push(`${BOLD}║       PROJECT HEALTH DASHBOARD       ║${RESET}`);
  lines.push(`${BOLD}╚══════════════════════════════════════╝${RESET}`);
  lines.push('');

  // Health bar
  lines.push(`  ${BOLD}Health Score${RESET}`);
  lines.push(`  ${formatProgressBar(score, 100, 30)}`);
  lines.push('');

  const label = score >= 90
    ? `${FG_GREEN}Excellent${RESET}`
    : score >= 75
      ? `${FG_GREEN}Good${RESET}`
      : score >= 60
        ? `${FG_YELLOW}Fair${RESET}`
        : score >= 40
          ? `${FG_RED}Needs Attention${RESET}`
          : `${FG_RED}${BOLD}Critical${RESET}`;

  lines.push(`  Status: ${label}`);
  lines.push('');

  // Maturity scores
  if (maturity && maturity.length > 0) {
    lines.push(`  ${BOLD}${UNDERLINE}Maturity Scores${RESET}`);
    lines.push('');

    const LEVEL_COLOR: Record<MaturityLevel, string> = {
      initial: FG_RED,
      developing: FG_YELLOW,
      defined: FG_CYAN,
      managed: FG_GREEN,
      optimizing: `${FG_GREEN}${BOLD}`,
    };

    const maxDimLen = Math.max(...maturity.map((m) => m.dimension.length));
    for (const ms of maturity) {
      const trendIcon = ms.trend === 'improving' ? `${FG_GREEN}↑${RESET}` : ms.trend === 'declining' ? `${FG_RED}↓${RESET}` : `${DIM}→${RESET}`;
      const levelColor = LEVEL_COLOR[ms.level] ?? FG_WHITE;
      const dimLabel = ms.dimension.padEnd(maxDimLen);
      const bar = formatProgressBar(ms.score, 100, 20);
      lines.push(`  ${dimLabel}  ${bar}  ${levelColor}${ms.level}${RESET} ${trendIcon}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
