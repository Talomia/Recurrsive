/**
 * Tests for the `recurrsive plugins` command.
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

import { registerPluginsCommand } from '../../commands/plugins.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerPluginsCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plugins command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    mockApiRequest.mockResolvedValue([
      { id: 'p1', name: 'test-plugin', version: '1.0.0', status: 'active', author: 'Test', updated: '2026-01-01' },
    ]);
  });

  it('registers the "plugins" command', () => {
    const program = createCLI();
    const cmd = program.commands.find((c) => c.name() === 'plugins');
    expect(cmd).toBeDefined();
  });

  it('has a "list" subcommand', () => {
    const program = createCLI();
    const plugins = program.commands.find((c) => c.name() === 'plugins')!;
    const sub = plugins.commands.find((c) => c.name() === 'list');
    expect(sub).toBeDefined();
  });

  it('has a "marketplace" subcommand', () => {
    const program = createCLI();
    const plugins = program.commands.find((c) => c.name() === 'plugins')!;
    const sub = plugins.commands.find((c) => c.name() === 'marketplace');
    expect(sub).toBeDefined();
  });

  it('has an "install" subcommand', () => {
    const program = createCLI();
    const plugins = program.commands.find((c) => c.name() === 'plugins')!;
    const sub = plugins.commands.find((c) => c.name() === 'install');
    expect(sub).toBeDefined();
  });

  it('has an "uninstall" subcommand', () => {
    const program = createCLI();
    const plugins = program.commands.find((c) => c.name() === 'plugins')!;
    const sub = plugins.commands.find((c) => c.name() === 'uninstall');
    expect(sub).toBeDefined();
  });

  it('has an "info" subcommand', () => {
    const program = createCLI();
    const plugins = program.commands.find((c) => c.name() === 'plugins')!;
    const sub = plugins.commands.find((c) => c.name() === 'info');
    expect(sub).toBeDefined();
  });

  it('marketplace subcommand supports --search option', () => {
    const program = createCLI();
    const plugins = program.commands.find((c) => c.name() === 'plugins')!;
    const marketplace = plugins.commands.find((c) => c.name() === 'marketplace')!;
    const opt = marketplace.options.find((o) => o.long === '--search');
    expect(opt).toBeDefined();
  });

  it('list subcommand supports --json option', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'plugins', 'list', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
