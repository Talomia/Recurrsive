/**
 * Tests for the `recurrsive audit` command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import type * as ConfigModule from '../../config.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock('../../config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { ...actual, apiRequest: mockApiRequest };
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
      mockApiRequest.mockResolvedValueOnce({
        events: [
          {
            id: 'evt_001',
            type: 'analysis',
            action: 'started',
            target: '/project',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'audit', 'list']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/audit'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'audit', 'list']);

      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        events: [
          {
            id: 'evt_001',
            type: 'analysis',
            action: 'started',
            target: '/project',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'audit', 'list', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('evt_'));
      spy.mockRestore();
    });
  });

  describe('search', () => {
    it('filters events by query', async () => {
      mockApiRequest.mockResolvedValueOnce({
        events: [
          {
            id: 'evt_010',
            type: 'policy',
            action: 'updated',
            target: '/policy/security',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const program = createCLI();
      await program.parseAsync(['node', 'test', 'audit', 'search', 'policy', '--json']);

      // Mock data contains a policy event — should match
      const output = spy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as Array<{ type: string }>;
      expect(parsed.some(e => e.type === 'policy')).toBe(true);
      spy.mockRestore();
    });
  });

  describe('export', () => {
    it('outputs JSON export', async () => {
      mockApiRequest.mockResolvedValueOnce({
        events: [
          {
            id: 'evt_001',
            type: 'analysis',
            action: 'started',
            target: '/project',
            timestamp: new Date().toISOString(),
          },
        ],
      });
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
