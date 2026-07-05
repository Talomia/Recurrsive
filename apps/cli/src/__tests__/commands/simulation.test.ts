/**
 * Tests for the `recurrsive simulate` command.
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
  bold: (s: string) => s,
  cyan: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  dim: (s: string) => s,
  magenta: (s: string) => s,
  table: vi.fn(),
}));

import { registerSimulationCommand } from '../../commands/simulation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerSimulationCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('simulate command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    mockApiRequest.mockResolvedValue([
      { id: 'sim-001', type: 'load-test', status: 'complete', riskLevel: 'MEDIUM', started: '2026-01-01', duration: '5m' },
    ]);
  });

  it('registers the "simulate" command', () => {
    const program = createCLI();
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    expect(cmd).toBeDefined();
  });

  it('has a "list" subcommand', () => {
    const program = createCLI();
    const simulate = program.commands.find((c) => c.name() === 'simulate')!;
    const sub = simulate.commands.find((c) => c.name() === 'list');
    expect(sub).toBeDefined();
  });

  it('has a "run" subcommand', () => {
    const program = createCLI();
    const simulate = program.commands.find((c) => c.name() === 'simulate')!;
    const sub = simulate.commands.find((c) => c.name() === 'run');
    expect(sub).toBeDefined();
  });

  it('has a "show" subcommand', () => {
    const program = createCLI();
    const simulate = program.commands.find((c) => c.name() === 'simulate')!;
    const sub = simulate.commands.find((c) => c.name() === 'show');
    expect(sub).toBeDefined();
  });

  it('run subcommand supports --duration option', () => {
    const program = createCLI();
    const simulate = program.commands.find((c) => c.name() === 'simulate')!;
    const run = simulate.commands.find((c) => c.name() === 'run')!;
    const opt = run.options.find((o) => o.long === '--duration');
    expect(opt).toBeDefined();
  });

  it('list subcommand supports --json option', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'simulate', 'list', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
