/**
 * Tests for the `recurrsive notifications` command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock('../../config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config.js')>();
  return { ...actual, apiRequest: mockApiRequest };
});

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  bold: (s: string) => s,
  cyan: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
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
      mockApiRequest.mockResolvedValueOnce({ channels });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'channels']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/channels'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'channels']);

      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON when --json flag is set', async () => {
      mockApiRequest.mockResolvedValueOnce({
        channels: [
          { type: 'console', name: 'Console', enabled: true, config_required: [], description: 'Terminal output' },
          { type: 'slack', name: 'Slack', enabled: false, config_required: ['webhookUrl'], description: 'Slack messages' },
        ],
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'channels', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('console'));
      spy.mockRestore();
    });
  });

  describe('test', () => {
    it('sends a test notification to the specified channel', async () => {
      mockApiRequest.mockResolvedValueOnce({ status: 'sent', channel: 'console', message: 'Test notification sent' });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'console']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/test'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rejects invalid channel names', async () => {
      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'invalid']);

      expect(process.exitCode).toBe(1);
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'slack']);

      expect(process.exitCode).toBe(1);
    });

    it('passes --url to server config', async () => {
      mockApiRequest.mockResolvedValueOnce({ status: 'sent', channel: 'slack', message: 'Sent' });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'test', 'slack', '--url', 'https://hooks.slack.com/xxx']);

      const body = JSON.parse(mockApiRequest.mock.calls[0][1].body);
      expect(body.channel).toBe('slack');
      expect(body.config).toBeDefined();
    });
  });

  describe('history', () => {
    it('fetches notification history from server', async () => {
      mockApiRequest.mockResolvedValueOnce({
        notifications: [
          { id: 'n1', channel: 'console', title: 'Analysis Done', severity: 'info', sent_at: new Date().toISOString(), status: 'delivered' },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/history'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history']);

      expect(process.exitCode).toBe(1);
    });

    it('supports --channel filter', async () => {
      mockApiRequest.mockResolvedValueOnce({
        notifications: [
          { id: 'notif_001', channel: 'slack', title: 'Deploy Complete', severity: 'info', sent_at: new Date().toISOString(), status: 'delivered' },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history', '--channel', 'slack']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('channel=slack'),
      );
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        notifications: [
          { id: 'notif_001', channel: 'console', title: 'Test', severity: 'info', sent_at: new Date().toISOString(), status: 'delivered' },
        ],
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'notifications', 'history', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('notif_'));
      spy.mockRestore();
    });
  });
});
