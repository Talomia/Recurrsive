/**
 * Tests for the `recurrsive notifications` command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  bold: (s: string) => s,
  cyan: (s: string) => s,
  green: (s: string) => s,
  red: (s: string) => s,
  dim: (s: string) => s,
  table: vi.fn(),
}));

import { registerNotificationsCommand } from '../../commands/notifications.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerNotificationsCommand(program);
  return program;
}

function mockApiResponse(data: unknown, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notifications command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('channels', () => {
    it('lists available notification channels from server', async () => {
      const channels = [
        { type: 'console', name: 'Console', enabled: true, config_required: [], description: 'Terminal output' },
        { type: 'slack', name: 'Slack', enabled: false, config_required: ['webhookUrl'], description: 'Slack messages' },
      ];
      mockApiResponse({ channels });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'channels']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/channels'),
        expect.any(Object),
      );
    });

    it('falls back to built-in channels when server unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'channels']);

      // Should not throw — falls back gracefully
      expect(process.exitCode).toBeUndefined();
    });

    it('outputs JSON when --json flag is set', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'channels', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('console'));
      spy.mockRestore();
    });
  });

  describe('test', () => {
    it('sends a test notification to the specified channel', async () => {
      mockApiResponse({ status: 'sent', channel: 'console', message: 'Test notification sent' });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'console']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/test'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rejects invalid channel names', async () => {
      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'invalid']);

      expect(process.exitCode).toBe(1);
    });

    it('falls back gracefully when server unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'slack']);

      expect(process.exitCode).toBeUndefined();
    });

    it('passes --url to server config', async () => {
      mockApiResponse({ status: 'sent', channel: 'slack', message: 'Sent' });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'slack', '--url', 'https://hooks.slack.com/xxx']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.channel).toBe('slack');
      expect(body.config).toBeDefined();
    });
  });

  describe('history', () => {
    it('fetches notification history from server', async () => {
      mockApiResponse({
        notifications: [
          { id: 'n1', channel: 'console', title: 'Analysis Done', severity: 'info', sent_at: new Date().toISOString(), status: 'delivered' },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/history'),
        expect.any(Object),
      );
    });

    it('falls back to mock data when server unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history']);

      expect(process.exitCode).toBeUndefined();
    });

    it('supports --channel filter', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history', '--channel', 'slack']);

      expect(process.exitCode).toBeUndefined();
    });

    it('outputs JSON with --json flag', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('notif_'));
      spy.mockRestore();
    });
  });
});
