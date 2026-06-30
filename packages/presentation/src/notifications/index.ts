/**
 * @module @recurrsive/presentation/notifications
 *
 * Barrel export for notification channels.
 *
 * @packageDocumentation
 */

// Base types
export type {
  NotificationChannel,
  Notification,
  NotificationPriority,
  DeliveryResult,
} from './base.js';

// Console channel
export { ConsoleNotificationChannel } from './console.js';

// Webhook channel
export { WebhookNotificationChannel } from './webhook.js';
export type { WebhookConfig } from './webhook.js';

// Slack channel
export { SlackNotifier, SEVERITY_SLACK_COLOR } from './slack.js';
export type {
  SlackConfig,
  SlackBlock,
  SlackHeaderBlock,
  SlackSectionBlock,
  SlackDividerBlock,
  SlackContextBlock,
  SlackAttachment,
  SlackPayload,
} from './slack.js';

// HTTP channel
export { HttpNotifier } from './http.js';
export type { HttpNotifierConfig } from './http.js';
