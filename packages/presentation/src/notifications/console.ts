/**
 * @module @recurrsive/presentation/notifications/console
 *
 * Console notification channel with ANSI colour formatting.
 *
 * @packageDocumentation
 */

import type { Severity } from '@recurrsive/core';
import type {
  NotificationChannel,
  Notification,
  DeliveryResult,
} from './base.js';

// ---------------------------------------------------------------------------
// ANSI colour codes
// ---------------------------------------------------------------------------

/** ANSI escape code reset. */
const RESET = '\x1b[0m';

/** Severity to ANSI colour mapping. */
const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '\x1b[31m',   // red
  high: '\x1b[33m',       // yellow
  medium: '\x1b[36m',     // cyan
  low: '\x1b[32m',        // green
  info: '\x1b[2m',        // dim
};

/** Severity to icon mapping. */
const SEVERITY_ICON: Record<Severity, string> = {
  critical: '✘',
  high: '⚠',
  medium: '●',
  low: '✔',
  info: 'ⓘ',
};

/** Bold ANSI escape. */
const BOLD = '\x1b[1m';

// ---------------------------------------------------------------------------
// Console Channel
// ---------------------------------------------------------------------------

/**
 * Notification channel that outputs to the console/terminal with
 * colour-coded severity levels.
 */
export class ConsoleNotificationChannel implements NotificationChannel {
  readonly name = 'console';

  private readonly writer: (msg: string) => void;

  /**
   * Create a ConsoleNotificationChannel.
   *
   * @param writer - Optional custom writer function (defaults to console.log)
   */
  constructor(writer?: (msg: string) => void) {
    // Console output is the explicit transport for this channel.
    // eslint-disable-next-line no-console
    this.writer = writer ?? console.log;
  }

  /**
   * Send a notification to the console with ANSI colour formatting.
   *
   * @param notification - The notification to display
   * @returns A successful delivery result
   */
  async send(notification: Notification): Promise<DeliveryResult> {
    const color = SEVERITY_COLOR[notification.severity];
    const icon = SEVERITY_ICON[notification.severity];

    const timestamp = notification.createdAt;
    const header = `${color}${icon} ${BOLD}[${notification.severity.toUpperCase()}]${RESET}${color} ${notification.title}${RESET}`;
    const time = `\x1b[2m${timestamp}${RESET}`;
    const body = `  ${notification.body}`;

    const lines: string[] = [
      '',
      `${header}  ${time}`,
      body,
    ];

    if (notification.sourceId) {
      lines.push(`  \x1b[2mSource: ${notification.sourceId}${RESET}`);
    }

    lines.push('');

    this.writer(lines.join('\n'));

    return {
      success: true,
      channel: this.name,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
  }
}
