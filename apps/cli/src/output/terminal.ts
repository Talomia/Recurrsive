/**
 * @module @recurrsive/cli/output/terminal
 *
 * ANSI colour helpers, progress spinners, box drawing, and table
 * formatting for the Recurrsive CLI. Uses raw ANSI escape codes so
 * there are zero runtime dependencies.
 *
 * @packageDocumentation
 */

import type { Severity } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// ANSI Escape Helpers
// ---------------------------------------------------------------------------

const ESC = '\x1b[';

const isColorDisabled =
  process.env['NO_COLOR'] !== undefined || process.env['TERM'] === 'dumb';

/**
 * Wrap text in an ANSI escape sequence pair.
 *
 * @param open - Opening escape code number.
 * @param close - Closing escape code number.
 * @param text - The text to wrap.
 * @returns Colorized string (or plain if NO_COLOR is set).
 */
function ansi(open: number, close: number, text: string): string {
  if (isColorDisabled) return text;
  return `${ESC}${open}m${text}${ESC}${close}m`;
}

// ─── Style Functions ─────────────────────────────────────────────────────────

/**
 * Render text in bold.
 * @param text - Text to embolden.
 * @returns Bolded string.
 */
export function bold(text: string): string {
  return ansi(1, 22, text);
}

/**
 * Render text with dim intensity.
 * @param text - Text to dim.
 * @returns Dimmed string.
 */
export function dim(text: string): string {
  return ansi(2, 22, text);
}

/**
 * Render text with underline.
 * @param text - Text to underline.
 * @returns Underlined string.
 */
export function underline(text: string): string {
  return ansi(4, 24, text);
}

// ─── Colour Functions ────────────────────────────────────────────────────────

/**
 * Render text in red.
 * @param text - Text to colour.
 * @returns Red-coloured string.
 */
export function red(text: string): string {
  return ansi(31, 39, text);
}

/**
 * Render text in green.
 * @param text - Text to colour.
 * @returns Green-coloured string.
 */
export function green(text: string): string {
  return ansi(32, 39, text);
}

/**
 * Render text in yellow.
 * @param text - Text to colour.
 * @returns Yellow-coloured string.
 */
export function yellow(text: string): string {
  return ansi(33, 39, text);
}

/**
 * Render text in blue.
 * @param text - Text to colour.
 * @returns Blue-coloured string.
 */
export function blue(text: string): string {
  return ansi(34, 39, text);
}

/**
 * Render text in magenta.
 * @param text - Text to colour.
 * @returns Magenta-coloured string.
 */
export function magenta(text: string): string {
  return ansi(35, 39, text);
}

/**
 * Render text in cyan.
 * @param text - Text to colour.
 * @returns Cyan-coloured string.
 */
export function cyan(text: string): string {
  return ansi(36, 39, text);
}

/**
 * Render text in white.
 * @param text - Text to colour.
 * @returns White-coloured string.
 */
export function white(text: string): string {
  return ansi(37, 39, text);
}

/**
 * Render text in gray (bright black).
 * @param text - Text to colour.
 * @returns Gray-coloured string.
 */
export function gray(text: string): string {
  return ansi(90, 39, text);
}

// ─── Severity Colours ────────────────────────────────────────────────────────

/**
 * Map a {@link Severity} value to a coloured string.
 *
 * @param severity - The severity level.
 * @returns A coloured, uppercased severity label.
 */
export function severityColor(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return bold(red('CRITICAL'));
    case 'high':
      return red('HIGH');
    case 'medium':
      return yellow('MEDIUM');
    case 'low':
      return cyan('LOW');
    case 'info':
      return dim('INFO');
  }
}

/**
 * Map a severity to a single-character badge icon.
 *
 * @param severity - The severity level.
 * @returns A coloured badge character.
 */
export function severityBadge(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return red('⬤');
    case 'high':
      return red('●');
    case 'medium':
      return yellow('●');
    case 'low':
      return cyan('●');
    case 'info':
      return dim('○');
  }
}

// ─── Status Messages ─────────────────────────────────────────────────────────

/**
 * Print a success message to stdout.
 * @param message - The message text.
 */
export function success(message: string): void {
  console.log(`${green('✔')} ${message}`);
}

/**
 * Print an error message to stderr and mark the process as failed.
 *
 * Sets `process.exitCode = 1` (without exiting immediately) so scripts and CI
 * can detect the failure — previously commands that reported errors through
 * this helper still exited 0.
 *
 * @param message - The message text.
 */
export function error(message: string): void {
  console.error(`${red('✖')} ${message}`);
  process.exitCode = 1;
}

/**
 * Print a warning message to stderr.
 * @param message - The message text.
 */
export function warning(message: string): void {
  console.error(`${yellow('⚠')} ${message}`);
}

/**
 * Print an info message to stdout.
 * @param message - The message text.
 */
export function info(message: string): void {
  console.log(`${cyan('ℹ')} ${message}`);
}

/**
 * Print a step message (during pipelines).
 * @param step - Current step number.
 * @param total - Total steps.
 * @param message - The step description.
 */
export function step(step: number, total: number, message: string): void {
  console.log(`${dim(`[${step}/${total}]`)} ${message}`);
}

// ─── Box Drawing ─────────────────────────────────────────────────────────────

/**
 * Draw a box around a title string.
 *
 * @param title - The title text.
 * @param subtitle - Optional subtitle below the title.
 * @returns The rendered box string.
 */
export function box(title: string, subtitle?: string): string {
  // Strip ANSI escapes for width calculation
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const titleLen = strip(title).length;
  const subtitleLen = subtitle ? strip(subtitle).length : 0;
  const width = Math.max(titleLen, subtitleLen) + 4;

  const top = `╭${'─'.repeat(width)}╮`;
  const bottom = `╰${'─'.repeat(width)}╯`;
  const padTitle = ' '.repeat(width - titleLen - 2);
  const line1 = `│  ${title}${padTitle}│`;

  const lines = [top, line1];

  if (subtitle) {
    const padSub = ' '.repeat(width - subtitleLen - 2);
    lines.push(`│  ${subtitle}${padSub}│`);
  }

  lines.push(bottom);
  return lines.join('\n');
}

/**
 * Draw a section header.
 *
 * @param title - The section title.
 */
export function header(title: string): void {
  console.log('');
  console.log(bold(cyan(`── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`)));
  console.log('');
}

// ─── Progress Spinner ────────────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * A simple CLI progress spinner using ANSI escape codes.
 */
export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private currentMessage: string;

  /**
   * @param message - Initial spinner message.
   */
  constructor(message: string) {
    this.currentMessage = message;
  }

  /**
   * Start the spinner animation.
   * @returns `this` for chaining.
   */
  start(): this {
    if (this.interval) return this;
    const isTTY = process.stderr.isTTY;

    if (!isTTY) {
      process.stderr.write(`${this.currentMessage}...\n`);
      return this;
    }

    process.stderr.write('\x1b[?25l'); // hide cursor
    this.interval = setInterval(() => {
      const frame = SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length]!;
      process.stderr.write(`\r${cyan(frame)} ${this.currentMessage}`);
      this.frameIndex++;
    }, 80);

    return this;
  }

  /**
   * Update the spinner message mid-flight.
   * @param message - New message text.
   */
  update(message: string): void {
    this.currentMessage = message;
  }

  /**
   * Stop the spinner with a success message.
   * @param finalMessage - Optional override message.
   */
  succeed(finalMessage?: string): void {
    this.stop();
    const msg = finalMessage ?? this.currentMessage;
    process.stderr.write(`\r${green('✔')} ${msg}\n`);
  }

  /**
   * Stop the spinner with a failure message.
   * @param finalMessage - Optional override message.
   */
  fail(finalMessage?: string): void {
    this.stop();
    const msg = finalMessage ?? this.currentMessage;
    process.stderr.write(`\r${red('✖')} ${msg}\n`);
  }

  /**
   * Stop the spinner without a final status message.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (process.stderr.isTTY) {
      process.stderr.write('\r\x1b[K'); // clear line
      process.stderr.write('\x1b[?25h'); // show cursor
    }
  }
}

// ─── Table Formatting ────────────────────────────────────────────────────────

/**
 * Render a simple ASCII table from rows of strings.
 *
 * @param headers - Column header labels.
 * @param rows - Array of rows, each row is an array of cell strings.
 * @returns Formatted table string.
 */
export function table(headers: string[], rows: string[][]): string {
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const cellWidths = rows.map((r) => strip(r[i] ?? '').length);
    return Math.max(strip(h).length, ...cellWidths);
  });

  const pad = (s: string, width: number): string => {
    const visible = strip(s).length;
    return s + ' '.repeat(Math.max(0, width - visible));
  };

  const separator = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ` ${pad(bold(h), widths[i]!)} `).join('│');
  const dataLines = rows.map((row) =>
    row.map((cell, i) => ` ${pad(cell, widths[i]!)} `).join('│'),
  );

  return [headerLine, `─${separator}─`, ...dataLines].join('\n');
}

// ─── Visual Bar ──────────────────────────────────────────────────────────────

/**
 * Render a visual progress bar.
 *
 * @param value - Current value (0–max).
 * @param max - Maximum value.
 * @param width - Bar width in characters (default: 30).
 * @returns Rendered progress bar string.
 */
export function progressBar(value: number, max: number, width = 30): string {
  const ratio = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  let color: (s: string) => string;
  if (ratio >= 0.7) color = green;
  else if (ratio >= 0.4) color = yellow;
  else color = red;

  const bar = color('█'.repeat(filled)) + dim('░'.repeat(empty));
  return `${bar} ${bold(String(Math.round(ratio * 100)))}%`;
}

/**
 * Render a visual score bar with label.
 *
 * @param label - Label text.
 * @param score - Numeric score (0–100).
 * @param width - Bar width (default: 20).
 * @returns Rendered label + bar string.
 */
export function scoreBar(label: string, score: number, width = 20): string {
  const padded = label.padEnd(24);
  return `  ${padded} ${progressBar(score, 100, width)}`;
}

// ─── Banner ──────────────────────────────────────────────────────────────────

/**
 * Print the Recurrsive banner.
 */
export function banner(): void {
  console.log('');
  console.log(bold(cyan('  ╭─────────────────────────────────────╮')));
  console.log(bold(cyan('  │                                     │')));
  console.log(bold(cyan('  │  ') + magenta('◈') + cyan('  RECURRSIVE') + cyan('                    │')));
  console.log(bold(cyan('  │  ') + dim('   Engineering Intelligence') + cyan('      │')));
  console.log(bold(cyan('  │  ') + dim('   Platform') + cyan('                        │')));
  console.log(bold(cyan('  │                                     │')));
  console.log(bold(cyan('  ╰─────────────────────────────────────╯')));
  console.log('');
}
