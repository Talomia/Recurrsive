/**
 * Unit tests for the `recurrsive webhooks` command.
 *
 * Tests cover:
 * - Command registration with subcommands
 * - webhook list, add, remove, test, events subcommands
 * - JSON output mode
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  green: vi.fn((t: string) => t),
  red: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  table: vi.fn((_headers: string[], _rows: string[][]) => '<table>'),
}));

import { registerWebhooksCommand } from '../../commands/webhooks.js';
import {
  banner,
  header,
  error as termError,
  info,
  table,
} from '../../output/terminal.js';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerWebhooksCommand(program);
  return program;
}

function mockApiResponse(data: unknown, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recurrsive webhooks', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('registers the webhooks command with 5 subcommands', () => {
    const program = createTestProgram();
    const hooksCmd = program.commands.find((c) => c.name() === 'webhooks');

    expect(hooksCmd).toBeDefined();
    expect(hooksCmd!.commands.length).toBe(5);

    const subNames = hooksCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('list');
    expect(subNames).toContain('add');
    expect(subNames).toContain('remove');
    expect(subNames).toContain('test');
    expect(subNames).toContain('events');
  });

  it('webhooks list fetches and displays hooks', async () => {
    mockApiResponse({
      data: [{
        id: 'wh_000001',
        url: 'https://example.com/hook',
        active: true,
        events: ['analysis.complete'],
        delivery_count: 5,
        failure_count: 0,
      }],
      total: 1,
    });

    const program = createTestProgram();
    await program.parseAsync(['node', 'test', 'webhooks', 'list']);

    expect(banner).toHaveBeenCalled();
    expect(header).toHaveBeenCalled();
    expect(table).toHaveBeenCalledWith(
      ['ID', 'URL', 'Status', 'Events', 'Deliveries', 'Failures'],
      expect.any(Array),
    );
  });

  it('webhooks list with --json outputs raw JSON', async () => {
    const response = {
      data: [{
        id: 'wh_000001',
        url: 'https://example.com/hook',
        active: true,
        events: ['analysis.complete'],
        delivery_count: 0,
        failure_count: 0,
      }],
      total: 1,
    };
    mockApiResponse(response);

    const program = createTestProgram();
    await program.parseAsync(['node', 'test', 'webhooks', 'list', '--json']);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('webhooks add registers a new webhook', async () => {
    mockApiResponse({
      data: {
        id: 'wh_000002',
        url: 'https://example.com/new',
        events: ['analysis.complete', 'policy.violation'],
        active: true,
      },
    }, 201);

    const program = createTestProgram();
    await program.parseAsync([
      'node', 'test', 'webhooks', 'add',
      '--url', 'https://example.com/new',
      '--events', 'analysis.complete,policy.violation',
    ]);

    expect(banner).toHaveBeenCalled();
    expect(header).toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/webhooks'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('webhooks remove deletes a webhook', async () => {
    mockApiResponse({ data: { id: 'wh_000001', deleted: true } });

    const program = createTestProgram();
    await program.parseAsync(['node', 'test', 'webhooks', 'remove', 'wh_000001']);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/webhooks/wh_000001'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('webhooks test sends a test event', async () => {
    mockApiResponse({
      data: { delivered: true, payload: { event: 'analysis.complete' } },
    });

    const program = createTestProgram();
    await program.parseAsync(['node', 'test', 'webhooks', 'test', 'wh_000001']);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/webhooks/wh_000001/test'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('webhooks events lists supported event types', async () => {
    mockApiResponse({
      data: [
        { event: 'analysis.complete', description: 'Triggered on analysis completion' },
        { event: 'policy.violation', description: 'Triggered on policy violation' },
      ],
    });

    const program = createTestProgram();
    await program.parseAsync(['node', 'test', 'webhooks', 'events']);

    expect(table).toHaveBeenCalledWith(
      ['Event', 'Description'],
      expect.any(Array),
    );
  });

  it('webhooks list handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const program = createTestProgram();
    await program.parseAsync(['node', 'test', 'webhooks', 'list']);

    expect(termError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to list webhooks'),
    );
  });

  it('webhooks add requires --url and --events', () => {
    const program = createTestProgram();
    const hooksCmd = program.commands.find((c) => c.name() === 'webhooks');
    const addCmd = hooksCmd!.commands.find((c) => c.name() === 'add');

    const urlOpt = addCmd!.options.find((o) => o.long === '--url');
    const eventsOpt = addCmd!.options.find((o) => o.long === '--events');

    expect(urlOpt).toBeDefined();
    expect(urlOpt!.required).toBe(true);
    expect(eventsOpt).toBeDefined();
    expect(eventsOpt!.required).toBe(true);
  });

  it('webhooks empty list shows informational message', async () => {
    mockApiResponse({ data: [], total: 0 });

    const program = createTestProgram();
    await program.parseAsync(['node', 'test', 'webhooks', 'list']);

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('No webhooks registered'),
    );
  });
});
