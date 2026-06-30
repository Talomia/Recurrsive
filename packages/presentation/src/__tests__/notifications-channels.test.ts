/**
 * Tests for Slack and HTTP notification channels.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Notification } from '../notifications/base.js';
import {
  SlackNotifier,
  SEVERITY_SLACK_COLOR,
} from '../notifications/slack.js';
import type { HttpSender } from '../notifications/slack.js';
import { HttpNotifier } from '../notifications/http.js';
import type { HttpSenderFn } from '../notifications/http.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? 'notif-001',
    title: overrides.title ?? 'High CPU Usage',
    body: overrides.body ?? 'CPU usage exceeds 90% on host db-primary.',
    severity: overrides.severity ?? 'high',
    priority: overrides.priority ?? 'high',
    createdAt: overrides.createdAt ?? '2026-06-30T12:00:00Z',
    sourceId: overrides.sourceId ?? 'opp-123',
    metadata: overrides.metadata,
  };
}

// ---------------------------------------------------------------------------
// SlackNotifier
// ---------------------------------------------------------------------------

describe('SlackNotifier', () => {
  const defaultConfig = {
    webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
    channel: '#alerts',
    username: 'Recurrsive Bot',
  };

  // -----------------------------------------------------------------------
  // formatBlocks
  // -----------------------------------------------------------------------

  describe('formatBlocks', () => {
    it('creates valid Slack blocks with correct structure', () => {
      const notifier = new SlackNotifier(defaultConfig);
      const notification = makeNotification();
      const blocks = notifier.formatBlocks(notification);

      // Should have header, section (body), section (fields), divider, context
      expect(blocks.length).toBe(5);

      // Header block
      expect(blocks[0]).toEqual({
        type: 'header',
        text: expect.objectContaining({
          type: 'plain_text',
          text: notification.title,
        }),
      });

      // Body section
      expect(blocks[1]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: expect.stringContaining('HIGH'),
        },
      });
      expect((blocks[1] as { text: { text: string } }).text.text).toContain(
        notification.body,
      );

      // Fields section
      const fieldsBlock = blocks[2] as { fields?: Array<{ text: string }> };
      expect(fieldsBlock.fields).toBeDefined();
      expect(fieldsBlock.fields!.length).toBeGreaterThanOrEqual(2);

      // Divider
      expect(blocks[3]).toEqual({ type: 'divider' });

      // Context with notification ID
      expect(blocks[4]).toMatchObject({
        type: 'context',
        elements: expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining(notification.id),
          }),
        ]),
      });
    });

    it('includes source ID field when present', () => {
      const notifier = new SlackNotifier(defaultConfig);
      const notification = makeNotification({ sourceId: 'src-456' });
      const blocks = notifier.formatBlocks(notification);

      const fieldsBlock = blocks[2] as {
        fields?: Array<{ text: string }>;
      };
      const sourceField = fieldsBlock.fields?.find((f) =>
        f.text.includes('Source'),
      );
      expect(sourceField).toBeDefined();
      expect(sourceField!.text).toContain('src-456');
    });

    it('omits source ID field when not present', () => {
      const notifier = new SlackNotifier(defaultConfig);
      const notification: Notification = {
        id: 'notif-001',
        title: 'Test',
        body: 'Body text',
        severity: 'medium',
        priority: 'normal',
        createdAt: '2026-06-30T12:00:00Z',
      };
      const blocks = notifier.formatBlocks(notification);

      const fieldsBlock = blocks[2] as {
        fields?: Array<{ text: string }>;
      };
      // Should only have Priority and Created
      expect(fieldsBlock.fields?.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Severity colour mapping
  // -----------------------------------------------------------------------

  describe('severity colour mapping', () => {
    it.each([
      ['critical', '#E01E5A'],
      ['high', '#FF9F1C'],
      ['medium', '#ECB22E'],
      ['low', '#2EB67D'],
      ['info', '#36C5F0'],
    ] as const)('maps %s to %s', (severity, expectedColor) => {
      expect(SEVERITY_SLACK_COLOR[severity]).toBe(expectedColor);
    });
  });

  // -----------------------------------------------------------------------
  // send
  // -----------------------------------------------------------------------

  describe('send', () => {
    it('returns success when webhook responds ok', async () => {
      const sender: HttpSender = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const notifier = new SlackNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(true);
      expect(result.channel).toBe('slack');
      expect(result.retries).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('returns success using default mock sender', async () => {
      const notifier = new SlackNotifier(defaultConfig);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(true);
      expect(result.channel).toBe('slack');
    });

    it('sends correct payload to webhook URL', async () => {
      const sender = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const notifier = new SlackNotifier(defaultConfig, sender);
      await notifier.send(makeNotification({ severity: 'critical' }));

      expect(sender).toHaveBeenCalledWith(
        defaultConfig.webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Verify payload structure
      const callBody = JSON.parse(sender.mock.calls[0][1].body);
      expect(callBody.channel).toBe('#alerts');
      expect(callBody.username).toBe('Recurrsive Bot');
      expect(callBody.attachments).toHaveLength(1);
      expect(callBody.attachments[0].color).toBe('#E01E5A'); // critical = red
    });

    it('returns failure when webhook responds with error', async () => {
      const sender: HttpSender = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const notifier = new SlackNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(false);
      expect(result.channel).toBe('slack');
      expect(result.error).toContain('500');
      expect(result.error).toContain('Internal Server Error');
    });

    it('handles network errors gracefully', async () => {
      const sender: HttpSender = vi
        .fn()
        .mockRejectedValue(new Error('Network timeout'));

      const notifier = new SlackNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(false);
      expect(result.channel).toBe('slack');
      expect(result.error).toBe('Network timeout');
    });

    it('handles non-Error thrown values gracefully', async () => {
      const sender: HttpSender = vi.fn().mockRejectedValue('string error');

      const notifier = new SlackNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });
});

// ---------------------------------------------------------------------------
// HttpNotifier
// ---------------------------------------------------------------------------

describe('HttpNotifier', () => {
  const defaultConfig = {
    url: 'https://api.example.com/notifications',
  };

  // -----------------------------------------------------------------------
  // send
  // -----------------------------------------------------------------------

  describe('send', () => {
    it('returns success when endpoint responds ok', async () => {
      const sender: HttpSenderFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const notifier = new HttpNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(true);
      expect(result.channel).toBe('http');
      expect(result.retries).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('returns success using default mock sender', async () => {
      const notifier = new HttpNotifier(defaultConfig);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(true);
      expect(result.channel).toBe('http');
    });

    it('uses custom headers when provided', async () => {
      const sender = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const notifier = new HttpNotifier(
        {
          url: 'https://api.example.com/notifications',
          headers: {
            Authorization: 'Bearer token-123',
            'X-Custom-Header': 'custom-value',
          },
        },
        sender,
      );

      await notifier.send(makeNotification());

      const callInit = sender.mock.calls[0][1];
      expect(callInit.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123',
        'X-Custom-Header': 'custom-value',
      });
    });

    it('uses custom HTTP method when provided', async () => {
      const sender = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const notifier = new HttpNotifier(
        { url: 'https://api.example.com/notifications', method: 'PUT' },
        sender,
      );

      await notifier.send(makeNotification());

      const callInit = sender.mock.calls[0][1];
      expect(callInit.method).toBe('PUT');
    });

    it('sends correct JSON payload', async () => {
      const sender = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const notification = makeNotification({
        id: 'n-42',
        title: 'Test',
        severity: 'low',
      });
      const notifier = new HttpNotifier(defaultConfig, sender);
      await notifier.send(notification);

      const payload = JSON.parse(sender.mock.calls[0][1].body);
      expect(payload.id).toBe('n-42');
      expect(payload.title).toBe('Test');
      expect(payload.severity).toBe('low');
    });

    it('returns failure when endpoint responds with error', async () => {
      const sender: HttpSenderFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      });

      const notifier = new HttpNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(false);
      expect(result.channel).toBe('http');
      expect(result.error).toContain('502');
      expect(result.error).toContain('Bad Gateway');
    });

    it('handles network errors gracefully', async () => {
      const sender: HttpSenderFn = vi
        .fn()
        .mockRejectedValue(new Error('Connection refused'));

      const notifier = new HttpNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(false);
      expect(result.channel).toBe('http');
      expect(result.error).toBe('Connection refused');
    });

    it('handles non-Error thrown values gracefully', async () => {
      const sender: HttpSenderFn = vi.fn().mockRejectedValue(42);

      const notifier = new HttpNotifier(defaultConfig, sender);
      const result = await notifier.send(makeNotification());

      expect(result.success).toBe(false);
      expect(result.error).toBe('42');
    });
  });
});
