/**
 * @module @recurrsive/presentation/notifications/base
 *
 * Base types and interfaces for notification channels.
 *
 * @packageDocumentation
 */

import type { Severity } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

/** Priority level for a notification. */
export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * A notification to be delivered through a channel.
 */
export interface Notification {
  /** Unique identifier for this notification. */
  id: string;
  /** Short title/subject. */
  title: string;
  /** Full notification body. */
  body: string;
  /** Severity of the originating opportunity. */
  severity: Severity;
  /** Delivery priority. */
  priority: NotificationPriority;
  /** ISO-8601 timestamp of when the notification was created. */
  createdAt: string;
  /** Optional URL or identifier linking back to the opportunity. */
  sourceId?: string;
  /** Arbitrary metadata. */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Delivery result
// ---------------------------------------------------------------------------

/** Result of a notification delivery attempt. */
export interface DeliveryResult {
  /** Whether delivery succeeded. */
  success: boolean;
  /** Channel that processed the delivery. */
  channel: string;
  /** ISO-8601 timestamp of the delivery attempt. */
  timestamp: string;
  /** Error message if delivery failed. */
  error?: string;
  /** Number of retry attempts made. */
  retries: number;
}

// ---------------------------------------------------------------------------
// NotificationChannel interface
// ---------------------------------------------------------------------------

/**
 * Interface for notification delivery channels.
 *
 * Implementations must provide `send` and `name`.
 */
export interface NotificationChannel {
  /** Human-readable channel name. */
  readonly name: string;

  /**
   * Send a notification through this channel.
   *
   * @param notification - The notification to send
   * @returns The delivery result
   */
  send(notification: Notification): Promise<DeliveryResult>;
}
