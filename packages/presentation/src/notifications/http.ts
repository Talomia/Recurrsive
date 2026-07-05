/**
 * @module @recurrsive/presentation/notifications/http
 *
 * Generic HTTP notification channel for posting notifications
 * to arbitrary HTTP endpoints.
 *
 * @packageDocumentation
 */

import type {
  NotificationChannel,
  Notification,
  DeliveryResult,
} from './base.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the generic HTTP notification channel. */
export interface HttpNotifierConfig {
  /** Target URL to POST notifications to. */
  url: string;
  /** Optional custom HTTP headers (merged with defaults). */
  headers?: Record<string, string>;
  /** HTTP method (defaults to 'POST'). */
  method?: string;
}

/**
 * Function signature for sending HTTP requests.
 * Defaults to the native `fetch` API.
 * Override with a custom sender for testing or custom HTTP clients.
 */
export type HttpSenderFn = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; statusText: string }>;

// ---------------------------------------------------------------------------
// Default fetch-based sender
// ---------------------------------------------------------------------------

/**
 * HTTP sender that uses the native `fetch` API.
 */
const fetchHttpSender: HttpSenderFn = async (url, init) => {
  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status, statusText: res.statusText };
};

// ---------------------------------------------------------------------------
// HttpNotifier
// ---------------------------------------------------------------------------

/**
 * Generic notification channel that sends notifications as JSON
 * via HTTP to a configurable endpoint.
 */
export class HttpNotifier implements NotificationChannel {
  readonly name = 'http';

  private readonly url: string;
  private readonly method: string;
  private readonly headers: Record<string, string>;
  private readonly sender: HttpSenderFn;

  /**
   * Create an HttpNotifier.
   *
   * @param config - HTTP endpoint configuration
   * @param sender - HTTP sender function (defaults to mock)
   */
  constructor(config: HttpNotifierConfig, sender?: HttpSenderFn) {
    this.url = config.url;
    this.method = config.method ?? 'POST';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    this.sender = sender ?? fetchHttpSender;
  }

  /**
   * Send a notification to the configured HTTP endpoint.
   *
   * @param notification - The notification to send
   * @returns The delivery result
   */
  async send(notification: Notification): Promise<DeliveryResult> {
    const payload = JSON.stringify({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      severity: notification.severity,
      priority: notification.priority,
      createdAt: notification.createdAt,
      sourceId: notification.sourceId,
      metadata: notification.metadata,
    });

    try {
      const response = await this.sender(this.url, {
        method: this.method,
        headers: this.headers,
        body: payload,
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
        error: `HTTP ${response.status}: ${response.statusText}`,
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
