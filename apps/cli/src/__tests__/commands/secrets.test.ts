/**
 * Tests for the `recurrsive secrets` command.
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
  success: vi.fn(),
  warning: vi.fn(),
  bold: (s: string) => s,
  cyan: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  dim: (s: string) => s,
  magenta: (s: string) => s,
  table: vi.fn(),
}));

import { registerSecretsCommand } from '../../commands/secrets.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerSecretsCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('secrets command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    mockApiRequest.mockResolvedValue({
      data: [
        { id: 's1', key: 'DB_PASSWORD', backend: 'vault', version: 3, lastRotated: '2026-01-01', rotationIntervalDays: 90, tags: [] },
      ],
      total: 1,
    });
  });

  it('registers the "secrets" command', () => {
    const program = createCLI();
    const cmd = program.commands.find((c) => c.name() === 'secrets');
    expect(cmd).toBeDefined();
  });

  it('has a "list" subcommand', () => {
    const program = createCLI();
    const secrets = program.commands.find((c) => c.name() === 'secrets')!;
    const sub = secrets.commands.find((c) => c.name() === 'list');
    expect(sub).toBeDefined();
  });

  it('has a "rotate" subcommand', () => {
    const program = createCLI();
    const secrets = program.commands.find((c) => c.name() === 'secrets')!;
    const sub = secrets.commands.find((c) => c.name() === 'rotate');
    expect(sub).toBeDefined();
  });

  it('has an "audit-log" subcommand', () => {
    const program = createCLI();
    const secrets = program.commands.find((c) => c.name() === 'secrets')!;
    const sub = secrets.commands.find((c) => c.name() === 'audit-log');
    expect(sub).toBeDefined();
  });

  it('audit-log subcommand supports --limit option', () => {
    const program = createCLI();
    const secrets = program.commands.find((c) => c.name() === 'secrets')!;
    const auditLog = secrets.commands.find((c) => c.name() === 'audit-log')!;
    const opt = auditLog.options.find((o) => o.long === '--limit');
    expect(opt).toBeDefined();
  });

  it('list subcommand supports --json option', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'secrets', 'list', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
