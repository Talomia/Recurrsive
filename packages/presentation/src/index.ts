/**
 * @module @recurrsive/presentation
 *
 * Barrel export for the presentation package.
 *
 * @packageDocumentation
 */

// Reports
export { generateReport } from './reports/index.js';
export { generateMarkdownReport } from './reports/markdown.js';
export { generateHtmlReport } from './reports/html.js';
export type {
  ReportFormat,
  ReportOptions,
} from './reports/index.js';
export type { MarkdownReportOptions } from './reports/markdown.js';
export type { HtmlReportOptions } from './reports/html.js';

// Notifications
export type {
  NotificationChannel,
  Notification,
  NotificationPriority,
  DeliveryResult,
} from './notifications/base.js';
export { ConsoleNotificationChannel } from './notifications/console.js';
export { WebhookNotificationChannel } from './notifications/webhook.js';
export type { WebhookConfig } from './notifications/webhook.js';

// Formatters
export {
  formatTable,
  formatProgressBar,
  formatOpportunities,
  formatOpportunityDetail,
  formatHealthScore,
} from './formatters/terminal.js';
