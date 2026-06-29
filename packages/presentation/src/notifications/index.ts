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
