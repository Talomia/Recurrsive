/**
 * Unit tests for the `recurrsive policy` command.
 *
 * Tests cover:
 * - Command registration with subcommands (check, list)
 * - Policy list displays built-in policies
 * - Policy check with JSON output
 * - Policy check with table output
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

const {
  mockDispose,
} = vi.hoisted(() => ({
  mockDispose: vi.fn(),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    dispose: mockDispose,
  }),
}));

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('@recurrsive/policy', () => ({
  PolicyEngine: vi.fn().mockImplementation(() => ({
    getPolicies: vi.fn().mockReturnValue([
      {
        id: 'security-baseline',
        name: 'Security Baseline',
        description: 'Basic security rules',
        enabled: true,
        rules: [
          {
            id: 'rule-1',
            name: 'Critical severity check',
            description: 'Block critical issues',
            scope: 'all',
            action: 'block',
            condition: 'severity == "critical"',
          },
        ],
      },
    ]),
    passes: vi.fn().mockReturnValue({
      passed: true,
      effectiveAction: 'allow',
      violations: [],
      warnings: [],
      evaluations: [],
    }),
  })),
  BUILTIN_POLICIES: [
    {
      id: 'security-baseline',
      name: 'Security Baseline',
      description: 'Basic security rules',
      enabled: true,
      rules: [
        {
          id: 'rule-1',
          name: 'Critical severity check',
          description: 'Block critical issues',
          scope: 'all',
          action: 'block',
          condition: 'severity == "critical"',
        },
      ],
    },
  ],
}));

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  green: vi.fn((t: string) => t),
  yellow: vi.fn((t: string) => t),
  red: vi.fn((t: string) => t),
  magenta: vi.fn((t: string) => t),
  table: vi.fn((_headers: string[], _rows: string[][]) => '<table>'),
}));

import { loadConfig } from '../../config/loader.js';
import { registerPolicyCommand } from '../../commands/policy.js';
import {
  banner,
  header,
  info,
  table,
} from '../../output/terminal.js';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a test program and register the policy command. */
function createTestProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerPolicyCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recurrsive policy', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    (loadConfig as Mock).mockResolvedValue({
      config: {
        graph: {
          provider: 'sqlite',
          connection_string: null,
        },
        output: { directory: '.recurrsive/reports', format: 'markdown' },
      },
      projectRoot: '/tmp/test-project',
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('registers the policy command with check and list subcommands', () => {
    const program = createTestProgram();
    const policyCmd = program.commands.find((c) => c.name() === 'policy');

    expect(policyCmd).toBeDefined();
    expect(policyCmd!.commands.length).toBe(2);

    const subNames = policyCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('check');
    expect(subNames).toContain('list');
  });

  it('policy list displays active policy sets', async () => {
    const program = createTestProgram();

    await program.parseAsync(['node', 'test', 'policy', 'list']);

    expect(banner).toHaveBeenCalled();
    expect(header).toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
    expect(table).toHaveBeenCalledWith(
      ['Name', 'Scope', 'Action', 'Condition'],
      expect.any(Array),
    );
  });

  it('policy list with --json outputs JSON', async () => {
    const program = createTestProgram();

    await program.parseAsync(['node', 'test', 'policy', 'list', '--json']);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output)).not.toThrow();

    const parsed = JSON.parse(output);
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed[0]).toHaveProperty('id');
    expect(parsed[0]).toHaveProperty('name');
  });

  it('policy check shows compliance for zero opportunities', async () => {
    const program = createTestProgram();

    await program.parseAsync(['node', 'test', 'policy', 'check']);

    expect(banner).toHaveBeenCalled();
    expect(header).toHaveBeenCalled();
    // With empty opportunities list, should show informational message
    expect(info).toHaveBeenCalled();
  });

  it('policy check with --json outputs JSON summary', async () => {
    const program = createTestProgram();

    await program.parseAsync(['node', 'test', 'policy', 'check', '--json']);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output)).not.toThrow();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('summary');
    expect(parsed.summary).toHaveProperty('total');
    expect(parsed.summary).toHaveProperty('passed');
    expect(parsed.summary).toHaveProperty('compliance_rate');
    expect(parsed.summary).toHaveProperty('policy_sets');
  });

  it('policy check handles errors gracefully', async () => {
    const errorFn = (await import('../../output/terminal.js')).error;

    // Make loadConfig throw
    (loadConfig as Mock).mockRejectedValueOnce(new Error('Config not found'));

    const program = createTestProgram();

    await program.parseAsync(['node', 'test', 'policy', 'check']);

    expect(errorFn).toHaveBeenCalledWith(
      expect.stringContaining('Policy check failed'),
    );
  });

  it('policy list description is correct', () => {
    const program = createTestProgram();
    const policyCmd = program.commands.find((c) => c.name() === 'policy');
    const listCmd = policyCmd!.commands.find((c) => c.name() === 'list');

    expect(listCmd!.description()).toBe('List all active policy sets and their rules');
  });

  it('policy check description is correct', () => {
    const program = createTestProgram();
    const policyCmd = program.commands.find((c) => c.name() === 'policy');
    const checkCmd = policyCmd!.commands.find((c) => c.name() === 'check');

    expect(checkCmd!.description()).toBe('Run policy checks against all opportunities');
  });

  it('policy check --json option is registered', () => {
    const program = createTestProgram();
    const policyCmd = program.commands.find((c) => c.name() === 'policy');
    const checkCmd = policyCmd!.commands.find((c) => c.name() === 'check');
    const jsonOpt = checkCmd!.options.find((o) => o.long === '--json');

    expect(jsonOpt).toBeDefined();
  });

  it('policy list --json option is registered', () => {
    const program = createTestProgram();
    const policyCmd = program.commands.find((c) => c.name() === 'policy');
    const listCmd = policyCmd!.commands.find((c) => c.name() === 'list');
    const jsonOpt = listCmd!.options.find((o) => o.long === '--json');

    expect(jsonOpt).toBeDefined();
  });
});
