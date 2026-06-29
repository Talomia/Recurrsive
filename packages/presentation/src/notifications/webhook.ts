/**
 * @module @recurrsive/presentation/notifications/webhook
 *
 * Webhook notification channel with retry and exponential backoff.
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

/** Configuration for the webhook notification channel. */
export interface WebhookConfig {
  /** Target webhook URL. */
  url: string;
  /** Optional custom HTTP headers. */
  headers?: Record<string, string>;
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds (default: 1000). */
  initialBackoffMs?: number;
  /** HTTP method (default: POST). */
  method?: 'POST' | 'PUT';
  /** Request timeout in milliseconds (default: 10000). */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for a specified number of milliseconds.
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Webhook Channel
// ---------------------------------------------------------------------------

/**
 * Notification channel that sends notifications via HTTP POST/PUT
 * to a configurable webhook URL with retry support.
 *
 * Retries up to `maxRetries` times with exponential backoff
 * (delay doubles each attempt).
 */
export class WebhookNotificationChannel implements NotificationChannel {
  readonly name = 'webhook';

  private readonly config: Required<
    Pick<WebhookConfig, 'url' | 'maxRetries' | 'initialBackoffMs' | 'method' | 'timeoutMs'>
  > & {
    headers: Record<string, string>;
  };

  /**
   * Create a WebhookNotificationChannel.
   *
   * @param config - Webhook configuration
   */
  constructor(config: WebhookConfig) {
    this.config = {
      url: config.url,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      maxRetries: config.maxRetries ?? 3,
      initialBackoffMs: config.initialBackoffMs ?? 1000,
      method: config.method ?? 'POST',
      timeoutMs: config.timeoutMs ?? 10000,
    };
  }

  /**
   * Send a notification to the configured webhook URL.
   *
   * On failure, retries up to `maxRetries` times with exponential
   * backoff (initial delay × 2^attempt).
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

    let lastError = '';
    let retries = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs,
        );

        const response = await fetch(this.config.url, {
          method: this.config.method,
          headers: this.config.headers,
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return {
            success: true,
            channel: this.name,
            timestamp: new Date().toISOString(),
            retries,
          };
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          lastError = `Request timed out after ${this.config.timeoutMs}ms`;
        } else {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      retries = attempt + 1;

      // Exponential backoff before next retry (skip delay on last attempt)
      if (attempt < this.config.maxRetries) {
        const backoffMs = this.config.initialBackoffMs * Math.pow(2, attempt);
        await delay(backoffMs);
      }
    }

    return {
      success: false,
      channel: this.name,
      timestamp: new Date().toISOString(),
      error: `Failed after ${retries} retries. Last error: ${lastError}`,
      retries,
    };
  }
}
