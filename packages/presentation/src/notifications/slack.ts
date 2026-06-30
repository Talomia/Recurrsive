/**
 * @module @recurrsive/presentation/notifications/slack
 *
 * Slack notification channel using Block Kit and webhook integration.
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
// Slack Block Kit types (subset)
// ---------------------------------------------------------------------------

/** Supported Slack Block Kit block types. */
export type SlackBlock =
  | SlackHeaderBlock
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackContextBlock;

/** A header block. */
export interface SlackHeaderBlock {
  type: 'header';
  text: { type: 'plain_text'; text: string; emoji?: boolean };
}

/** A section block. */
export interface SlackSectionBlock {
  type: 'section';
  text: { type: 'mrkdwn'; text: string };
  fields?: Array<{ type: 'mrkdwn'; text: string }>;
}

/** A divider block. */
export interface SlackDividerBlock {
  type: 'divider';
}

/** A context block. */
export interface SlackContextBlock {
  type: 'context';
  elements: Array<{ type: 'mrkdwn'; text: string }>;
}

/** Slack attachment for severity colouring. */
export interface SlackAttachment {
  color: string;
  blocks: SlackBlock[];
}

/** Full Slack webhook payload. */
export interface SlackPayload {
  channel?: string;
  username?: string;
  attachments: SlackAttachment[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the Slack notification channel. */
export interface SlackConfig {
  /** Slack incoming webhook URL. */
  webhookUrl: string;
  /** Override the channel (e.g. '#alerts'). */
  channel?: string;
  /** Bot username displayed in Slack. */
  username?: string;
}

/**
 * Function signature for sending HTTP requests.
 * Defaults to a no-op mock; replace with a real `fetch` wrapper
 * when actual Slack integration is needed.
 */
export type HttpSender = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; statusText: string }>;

// ---------------------------------------------------------------------------
// Severity colours (Slack hex colours for attachment sidebar)
// ---------------------------------------------------------------------------

/** Severity to Slack attachment colour mapping. */
export const SEVERITY_SLACK_COLOR: Record<Severity, string> = {
  critical: '#E01E5A', // red
  high:     '#FF9F1C', // orange
  medium:   '#ECB22E', // yellow
  low:      '#2EB67D', // green
  info:     '#36C5F0', // blue
};

/** Severity to emoji mapping for Slack messages. */
const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: ':red_circle:',
  high:     ':large_orange_circle:',
  medium:   ':large_yellow_circle:',
  low:      ':large_green_circle:',
  info:     ':information_source:',
};

// ---------------------------------------------------------------------------
// Default mock sender
// ---------------------------------------------------------------------------

/**
 * Mock HTTP sender that simulates a successful webhook delivery.
 * No real network requests are made.
 */
const mockHttpSender: HttpSender = async () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
});

// ---------------------------------------------------------------------------
// SlackNotifier
// ---------------------------------------------------------------------------

/**
 * Notification channel that sends messages to Slack via incoming webhooks,
 * formatted with Block Kit blocks and severity-coloured attachments.
 */
export class SlackNotifier implements NotificationChannel {
  readonly name = 'slack';

  private readonly config: SlackConfig;
  private readonly sender: HttpSender;

  /**
   * Create a SlackNotifier.
   *
   * @param config - Slack webhook configuration
   * @param sender - HTTP sender function (defaults to mock)
   */
  constructor(config: SlackConfig, sender?: HttpSender) {
    this.config = config;
    this.sender = sender ?? mockHttpSender;
  }

  /**
   * Format a notification into Slack Block Kit blocks.
   *
   * @param notification - The notification to format
   * @returns An array of Slack blocks
   */
  formatBlocks(notification: Notification): SlackBlock[] {
    const emoji = SEVERITY_EMOJI[notification.severity];
    const blocks: SlackBlock[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${notification.title}`,
        emoji: true,
      },
    });

    // Severity + body
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${notification.severity.toUpperCase()}* — ${notification.body}`,
      },
    });

    // Metadata fields
    const fields: Array<{ type: 'mrkdwn'; text: string }> = [
      { type: 'mrkdwn', text: `*Priority:*\n${notification.priority}` },
      { type: 'mrkdwn', text: `*Created:*\n${notification.createdAt}` },
    ];

    if (notification.sourceId) {
      fields.push({
        type: 'mrkdwn',
        text: `*Source:*\n${notification.sourceId}`,
      });
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ' ' },
      fields,
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Context footer
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Notification ID: \`${notification.id}\``,
        },
      ],
    });

    return blocks;
  }

  /**
   * Send a notification to Slack via the configured webhook.
   *
   * @param notification - The notification to send
   * @returns The delivery result
   */
  async send(notification: Notification): Promise<DeliveryResult> {
    const blocks = this.formatBlocks(notification);
    const color = SEVERITY_SLACK_COLOR[notification.severity];

    const payload: SlackPayload = {
      ...(this.config.channel ? { channel: this.config.channel } : {}),
      ...(this.config.username ? { username: this.config.username } : {}),
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };

    try {
      const response = await this.sender(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return {
          success: true,
          channel: this.name,
          timestamp: new Date().toISOString(),
          retries: 0,
        };
      }

      return {
        success: false,
        channel: this.name,
        timestamp: new Date().toISOString(),
        error: `Slack webhook returned HTTP ${response.status}: ${response.statusText}`,
        retries: 0,
      };
    } catch (err) {
      return {
        success: false,
        channel: this.name,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        retries: 0,
      };
    }
  }
}
