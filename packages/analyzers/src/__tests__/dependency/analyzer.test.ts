/**
 * Tests for DependencyAnalyzer.
 *
 * Covers all 8 rules: outdated dependencies, missing lockfile,
 * known vulnerable patterns, unpinned dependencies, excessive
 * dependencies, dev dependency in production, missing security
 * policy, and deprecated dependency usage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DependencyAnalyzer } from '../../dependency/analyzer.js';
import type { AnalysisContext, Entity, Relationship } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();
let _idCounter = 0;
function nextId(): string {
  _idCounter++;
  const hex = _idCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

function makeEntity(overrides: Partial<Entity> & Pick<Entity, 'type' | 'name'>): Entity {
  return {
    id: nextId(),
    qualified_name: `test:${overrides.name}`,
    source: 'test-collector',
    properties: {},
    tags: [],
    created_at: NOW,
    updated_at: NOW,
    last_seen_at: NOW,
    ...overrides,
  };
}

type GetRelsFn = (id: string, dir: string) => Relationship[];

function makeContext(
  entitiesByType: Record<string, Entity[]> = {},
  relsFn: GetRelsFn = () => [],
  custom: Record<string, unknown> = {},
): AnalysisContext {
  return {
    graph: {
      getEntity: vi.fn(),
      getEntities: vi.fn().mockImplementation((type: string) =>
        Promise.resolve(entitiesByType[type] ?? []),
      ),
      getRelationships: vi.fn().mockImplementation((id: string, dir: string) =>
        Promise.resolve(relsFn(id, dir)),
      ),
      query: vi.fn(),
      getNeighbors: vi.fn(),
    },
    config: { enabled: true, severity_threshold: 'low', custom },
    history: {
      getPreviousFindings: vi.fn().mockResolvedValue([]),
      getAcceptedOpportunities: vi.fn().mockResolvedValue([]),
      getRejectedOpportunities: vi.fn().mockResolvedValue([]),
    },
    project: {
      name: 'test-project',
      root_path: '/tmp/test',
      languages: ['typescript'],
      frameworks: [],
      ai_providers: [],
    },
    emit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('dependency.vulnerabilities');
    expect(analyzer.name).toBe('Dependency Vulnerability Analyzer');
    expect(analyzer.categories).toContain('security');
    expect(analyzer.version).toBe('0.1.0');
  });

  it('has a description', () => {
    expect(analyzer.description).toBeTruthy();
    expect(analyzer.description.length).toBeGreaterThan(10);
  });

  // ── Rule 1: Outdated Dependencies ────────────────────────────────────

  describe('outdated dependencies', () => {
    it('detects dependencies marked as outdated via property', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'express',
        properties: { is_outdated: true },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const outdatedFindings = findings.filter((f) => f.title.includes('Outdated dependency'));
      expect(outdatedFindings).toHaveLength(1);
      expect(outdatedFindings[0]!.title).toContain('express');
    });

    it('detects dependencies marked as outdated via tag', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'react',
        tags: ['outdated'],
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const outdatedFindings = findings.filter((f) => f.title.includes('Outdated dependency'));
      expect(outdatedFindings).toHaveLength(1);
    });

    it('detects major version gaps between current and latest', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'webpack',
        properties: { version: '3.12.0', latest_version: '5.90.0' },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const outdatedFindings = findings.filter((f) => f.title.includes('Outdated dependency'));
      expect(outdatedFindings).toHaveLength(1);
      expect(outdatedFindings[0]!.severity).toBe('high');
    });

    it('does not flag deps with minor version differences', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'lodash',
        properties: { version: '4.17.20', latest_version: '4.17.21' },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const outdatedFindings = findings.filter((f) => f.title.includes('Outdated dependency'));
      expect(outdatedFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Lockfile ──────────────────────────────────────────

  describe('missing lockfile', () => {
    it('detects missing lockfile when dependencies exist', async () => {
      const dep = makeEntity({ type: 'dependency', name: 'express' });
      const file = makeEntity({ type: 'file', name: 'package.json' });
      const ctx = makeContext({ dependency: [dep], file: [file] });

      const findings = await analyzer.analyze(ctx);

      const lockFindings = findings.filter((f) => f.title.includes('Missing dependency lockfile'));
      expect(lockFindings).toHaveLength(1);
      expect(lockFindings[0]!.severity).toBe('high');
    });

    it('does not flag when package-lock.json exists', async () => {
      const dep = makeEntity({ type: 'dependency', name: 'express' });
      const lockfile = makeEntity({ type: 'file', name: 'package-lock.json' });
      const ctx = makeContext({ dependency: [dep], file: [lockfile] });

      const findings = await analyzer.analyze(ctx);

      const lockFindings = findings.filter((f) => f.title.includes('Missing dependency lockfile'));
      expect(lockFindings).toHaveLength(0);
    });

    it('does not flag when yarn.lock exists', async () => {
      const dep = makeEntity({ type: 'dependency', name: 'express' });
      const lockfile = makeEntity({ type: 'file', name: 'yarn.lock' });
      const ctx = makeContext({ dependency: [dep], file: [lockfile] });

      const findings = await analyzer.analyze(ctx);

      const lockFindings = findings.filter((f) => f.title.includes('Missing dependency lockfile'));
      expect(lockFindings).toHaveLength(0);
    });

    it('does not flag when there are no dependencies', async () => {
      const ctx = makeContext({ dependency: [], file: [] });

      const findings = await analyzer.analyze(ctx);

      const lockFindings = findings.filter((f) => f.title.includes('lockfile'));
      expect(lockFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Known Vulnerable Patterns ─────────────────────────────────

  describe('known vulnerable patterns', () => {
    it('detects lodash below safe version', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'lodash',
        properties: { version: '4.17.11' },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const vulnFindings = findings.filter((f) => f.title.includes('Known vulnerability'));
      expect(vulnFindings).toHaveLength(1);
      expect(vulnFindings[0]!.severity).toBe('critical');
      expect(vulnFindings[0]!.description).toContain('Prototype pollution');
    });

    it('does not flag lodash at safe version', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'lodash',
        properties: { version: '4.17.21' },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const vulnFindings = findings.filter((f) => f.title.includes('Known vulnerability'));
      expect(vulnFindings).toHaveLength(0);
    });

    it('detects packages tagged as vulnerable', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'minimist',
        tags: ['vulnerable'],
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const vulnFindings = findings.filter((f) => f.title.includes('Known vulnerability'));
      expect(vulnFindings).toHaveLength(1);
    });

    it('detects log4j as a known vulnerable pattern', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'log4j',
        properties: { version: '2.14.0', has_vulnerability: true },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const vulnFindings = findings.filter((f) => f.title.includes('Known vulnerability'));
      expect(vulnFindings).toHaveLength(1);
      expect(vulnFindings[0]!.description).toContain('Remote code execution');
    });
  });

  // ── Rule 4: Unpinned Dependencies ─────────────────────────────────────

  describe('unpinned dependencies', () => {
    it('detects dependencies with * version', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'some-lib',
        properties: { version: '*' },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const unpinnedFindings = findings.filter((f) => f.title.includes('Unpinned dependency'));
      expect(unpinnedFindings).toHaveLength(1);
      expect(unpinnedFindings[0]!.severity).toBe('high');
    });

    it('detects dependencies with "latest" version', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'some-lib',
        properties: { version_range: 'latest' },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const unpinnedFindings = findings.filter((f) => f.title.includes('Unpinned dependency'));
      expect(unpinnedFindings).toHaveLength(1);
    });

    it('does not flag pinned dependencies', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'express',
        properties: { version: '4.18.2' },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const unpinnedFindings = findings.filter((f) => f.title.includes('Unpinned dependency'));
      expect(unpinnedFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: Excessive Dependencies ─────────────────────────────────────

  describe('excessive dependencies', () => {
    it('detects more than 50 direct production dependencies', async () => {
      const deps: Entity[] = [];
      for (let i = 0; i < 55; i++) {
        deps.push(makeEntity({ type: 'dependency', name: `dep-${i}` }));
      }
      const ctx = makeContext({ dependency: deps, file: [] });

      const findings = await analyzer.analyze(ctx);

      const excessiveFindings = findings.filter((f) => f.title.includes('Excessive'));
      expect(excessiveFindings).toHaveLength(1);
      expect(excessiveFindings[0]!.severity).toBe('medium');
    });

    it('does not flag dev dependencies toward threshold', async () => {
      const deps: Entity[] = [];
      for (let i = 0; i < 55; i++) {
        deps.push(makeEntity({ type: 'dependency', name: `dep-${i}`, tags: ['dev'] }));
      }
      const ctx = makeContext({ dependency: deps, file: [] });

      const findings = await analyzer.analyze(ctx);

      const excessiveFindings = findings.filter((f) => f.title.includes('Excessive'));
      expect(excessiveFindings).toHaveLength(0);
    });

    it('respects custom threshold from config', async () => {
      const deps: Entity[] = [];
      for (let i = 0; i < 12; i++) {
        deps.push(makeEntity({ type: 'dependency', name: `dep-${i}` }));
      }
      const ctx = makeContext({ dependency: deps, file: [] }, () => [], {
        excessive_deps_threshold: 10,
      });

      const findings = await analyzer.analyze(ctx);

      const excessiveFindings = findings.filter((f) => f.title.includes('Excessive'));
      expect(excessiveFindings).toHaveLength(1);
    });
  });

  // ── Rule 6: Dev Dependency in Production ──────────────────────────────

  describe('dev dependency in production', () => {
    it('detects dev deps used in production code', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'jest',
        properties: { dev: true, used_in_production: true },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const devFindings = findings.filter((f) => f.title.includes('Dev dependency used in production'));
      expect(devFindings).toHaveLength(1);
      expect(devFindings[0]!.severity).toBe('high');
    });

    it('detects via tag combination', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'vitest',
        tags: ['devDependency', 'production-import'],
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const devFindings = findings.filter((f) => f.title.includes('Dev dependency used in production'));
      expect(devFindings).toHaveLength(1);
    });

    it('does not flag dev deps not used in production', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'jest',
        properties: { dev: true },
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const devFindings = findings.filter((f) => f.title.includes('Dev dependency'));
      expect(devFindings).toHaveLength(0);
    });
  });

  // ── Rule 7: Missing Security Policy ────────────────────────────────────

  describe('missing security policy', () => {
    it('detects missing SECURITY.md when deps exist', async () => {
      const dep = makeEntity({ type: 'dependency', name: 'express' });
      const file = makeEntity({ type: 'file', name: 'README.md' });
      const ctx = makeContext({ dependency: [dep], file: [file] });

      const findings = await analyzer.analyze(ctx);

      const policyFindings = findings.filter((f) => f.title.includes('Missing security policy'));
      expect(policyFindings).toHaveLength(1);
      expect(policyFindings[0]!.severity).toBe('low');
    });

    it('does not flag when SECURITY.md exists', async () => {
      const dep = makeEntity({ type: 'dependency', name: 'express' });
      const securityFile = makeEntity({ type: 'file', name: 'SECURITY.md' });
      const ctx = makeContext({ dependency: [dep], file: [securityFile] });

      const findings = await analyzer.analyze(ctx);

      const policyFindings = findings.filter((f) => f.title.includes('Missing security policy'));
      expect(policyFindings).toHaveLength(0);
    });
  });

  // ── Rule 8: Deprecated Dependencies ────────────────────────────────────

  describe('deprecated dependencies', () => {
    it('does NOT label maintained packages like moment as deprecated — suggests alternative at info', async () => {
      // moment is in maintenance mode but NOT deprecated; asserting
      // "deprecated" would be false. It gets an info-level suggestion instead.
      const dep = makeEntity({
        type: 'dependency',
        name: 'moment',
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const depFindings = findings.filter((f) => f.title.includes('Deprecated dependency'));
      expect(depFindings).toHaveLength(0);

      const altFindings = findings.filter((f) => f.title.includes('Consider built-in alternative'));
      expect(altFindings).toHaveLength(1);
      expect(altFindings[0]!.severity).toBe('info');
      expect(altFindings[0]!.description).toContain('date-fns');
    });

    it('does NOT flag maintained packages uuid/mkdirp/rimraf as deprecated', async () => {
      const deps = ['uuid', 'mkdirp', 'rimraf'].map((name) =>
        makeEntity({ type: 'dependency', name }),
      );
      const ctx = makeContext({ dependency: deps, file: [] });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Deprecated dependency'))).toHaveLength(0);
      const altFindings = findings.filter((f) => f.title.includes('Consider built-in alternative'));
      expect(altFindings).toHaveLength(3);
      for (const f of altFindings) {
        expect(f.severity).toBe('info');
      }
    });

    it('detects known deprecated packages like request', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'request',
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const depFindings = findings.filter((f) => f.title.includes('Deprecated dependency'));
      expect(depFindings).toHaveLength(1);
      expect(depFindings[0]!.description).toContain('node-fetch');
    });

    it('detects deps tagged as deprecated', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'custom-old-lib',
        tags: ['deprecated'],
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const depFindings = findings.filter((f) => f.title.includes('Deprecated dependency'));
      expect(depFindings).toHaveLength(1);
    });

    it('does not flag non-deprecated packages', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'express',
      });
      const ctx = makeContext({ dependency: [dep], file: [] });

      const findings = await analyzer.analyze(ctx);

      const depFindings = findings.filter((f) => f.title.includes('Deprecated dependency'));
      expect(depFindings).toHaveLength(0);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize resolves without error', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
  });

  it('finalize returns empty array when no systemic issues', async () => {
    const ctx = makeContext();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });

  it('finalize detects high proportion of vulnerable deps', async () => {
    const deps: Entity[] = [];
    for (let i = 0; i < 5; i++) {
      deps.push(
        makeEntity({
          type: 'dependency',
          name: `dep-${i}`,
          tags: i < 3 ? ['vulnerable'] : [],
        }),
      );
    }
    const ctx = makeContext({ dependency: deps });

    const finalized = await analyzer.finalize(ctx);

    expect(finalized).toHaveLength(1);
    expect(finalized[0]!.title).toContain('High proportion');
    expect(finalized[0]!.severity).toBe('critical');
  });

  // ── Severity levels ─────────────────────────────────────────────────

  it('produces correct severity levels for each rule type', async () => {
    const entities = {
      dependency: [
        makeEntity({
          type: 'dependency',
          name: 'lodash',
          properties: { version: '4.17.0' },
          tags: ['vulnerable'],
        }),
      ],
      file: [],
    };
    const ctx = makeContext(entities);

    const findings = await analyzer.analyze(ctx);

    // Known vulnerable → critical
    const vulnFindings = findings.filter((f) => f.title.includes('Known vulnerability'));
    expect(vulnFindings[0]!.severity).toBe('critical');
  });
});
