/**
 * Tests for the `recurrsive audit` command.
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
  return {
    ...actual,
    apiRequest: mockApiRequest,
    apiRequestData: (...a: unknown[]) =>
      (mockApiRequest as (...x: unknown[]) => Promise<{ data?: unknown }>)(...a).then((e) => e?.data),
    apiRequestList: (...a: unknown[]) =>
      (mockApiRequest as (...x: unknown[]) => Promise<{ data?: unknown[]; total?: number }>)(...a).then((e) => ({
        items: e?.data ?? [],
        total: e?.total ?? (e?.data?.length ?? 0),
      })),
  };
});

vi.mock('../../output/terminal.js', () => ({
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


import { registerAuditCommand } from '../../commands/audit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_001',
    timestamp: new Date().toISOString(),
    userId: 'user_1',
    username: 'admin',
    method: 'POST',
    url: '/api/v1/analyze',
    statusCode: 202,
    action: 'write',
    ...overrides,
  };
}

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerAuditCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('audit command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('list', () => {
    it('fetches events from the audit API', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: [sampleEvent()], total: 1 });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'audit', 'list']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/audit'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'audit', 'list']),
      ).rejects.toThrow();
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: [sampleEvent()], total: 1 });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'audit', 'list', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('evt_'));
      spy.mockRestore();
    });
  });

  describe('filter', () => {
    it('queries the audit endpoint with structured filters', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: [sampleEvent({ id: 'evt_010', action: 'admin' })],
        total: 1,
      });

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const program = createCLI();
      await program.parseAsync([
        'node', 'test', 'audit', 'filter', '--action', 'admin', '--json',
      ]);

      // Path should carry the structured filter, not a keyword search route.
      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('action=admin'),
      );
      const output = spy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as Array<{ action: string }>;
      expect(parsed.some((e) => e.action === 'admin')).toBe(true);
      spy.mockRestore();
    });
  });

  describe('export', () => {
    it('outputs JSON export', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: [sampleEvent()], total: 1 });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'audit', 'export']);

      const output = spy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as { exported_at: string; event_count: number; events: unknown[] };
      expect(parsed).toHaveProperty('exported_at');
      expect(parsed).toHaveProperty('event_count');
      expect(parsed).toHaveProperty('events');
      expect(parsed.events.length).toBeGreaterThan(0);
      spy.mockRestore();
    });
  });
});
