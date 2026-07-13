import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotification,
  getNotificationChannels,
  getNotificationHistory,
  getWebhookEvents,
  updateNotification,
} from '../../lib/api/governance';

function respond(data: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ data }),
  });
}

describe('governance API adapters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps webhook event names from the server contract', async () => {
    respond([{ event: 'analysis.complete', description: 'Completed' }]);
    await expect(getWebhookEvents()).resolves.toEqual([
      { type: 'analysis.complete', description: 'Completed' },
    ]);
  });

  it('maps notification channel configuration for the dashboard', async () => {
    respond([{ channel: 'http', description: 'Custom endpoint', configured: false, config_hint: 'Provide a URL' }]);
    await expect(getNotificationChannels()).resolves.toEqual([
      { type: 'http', name: 'HTTP', enabled: false, description: 'Custom endpoint' },
    ]);
  });

  it('maps history statuses and omits dismissed notifications', async () => {
    respond([
      { id: 'one', channel: 'console', title: 'Done', message: 'Done', sent_at: '2026-01-01', status: 'sent', severity: 'info', dismissed: false },
      { id: 'two', channel: 'console', message: 'Hidden', sent_at: '2026-01-01', status: 'failed', dismissed: true },
    ]);
    await expect(getNotificationHistory()).resolves.toEqual([
      { id: 'one', channel: 'console', title: 'Done', severity: 'info', sent_at: '2026-01-01', status: 'delivered' },
    ]);
  });

  it('maps and updates notification detail state', async () => {
    respond({
      id: 'one', channel: 'console', title: 'Done', message: 'Complete', sent_at: '2026-01-01',
      status: 'sent', severity: 'info', read: false, dismissed: false,
    });
    await expect(getNotification('one')).resolves.toMatchObject({
      id: 'one', title: 'Done', type: 'success', source: 'console', read: false,
    });

    respond({
      id: 'one', channel: 'console', title: 'Done', message: 'Complete', sent_at: '2026-01-01',
      status: 'sent', severity: 'info', read: true, dismissed: false,
    });
    await expect(updateNotification('one', { read: true })).resolves.toMatchObject({ read: true });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/notifications/one'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ read: true }) }),
    );
  });
});
