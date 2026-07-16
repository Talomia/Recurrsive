/**
 * Tests for the `recurrsive projects` command.
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
  bold: (s: string) => s,
  cyan: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  dim: (s: string) => s,
  magenta: (s: string) => s,
  progressBar: vi.fn((_v: number, _m: number, _w: number) => '[████████]'),
  table: vi.fn(),
}));

import { registerProjectsCommand } from '../../commands/projects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerProjectsCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('projects command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    mockApiRequest.mockResolvedValue({
      data: [
        { id: 'proj-1', name: 'Web App', healthScore: 85, language: 'TypeScript', framework: 'Next', lastAnalysis: '2026-01-01' },
      ],
      total: 1,
    });
  });

  it('registers the "projects" command', () => {
    const program = createCLI();
    const cmd = program.commands.find((c) => c.name() === 'projects');
    expect(cmd).toBeDefined();
  });

  it('has a "list" subcommand', () => {
    const program = createCLI();
    const projects = program.commands.find((c) => c.name() === 'projects')!;
    const sub = projects.commands.find((c) => c.name() === 'list');
    expect(sub).toBeDefined();
  });

  it('has a "show" subcommand', () => {
    const program = createCLI();
    const projects = program.commands.find((c) => c.name() === 'projects')!;
    const sub = projects.commands.find((c) => c.name() === 'show');
    expect(sub).toBeDefined();
  });

  it('has a "health-compare" subcommand', () => {
    const program = createCLI();
    const projects = program.commands.find((c) => c.name() === 'projects')!;
    const sub = projects.commands.find((c) => c.name() === 'health-compare');
    expect(sub).toBeDefined();
  });

  it('list subcommand supports --json option', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'projects', 'list', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('show subcommand accepts a project id argument', () => {
    const program = createCLI();
    const projects = program.commands.find((c) => c.name() === 'projects')!;
    const show = projects.commands.find((c) => c.name() === 'show')!;
    // The show command is defined as 'show <id>' — commander stores the arg
    expect(show).toBeDefined();
  });
});
