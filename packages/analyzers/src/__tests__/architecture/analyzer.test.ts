/**
 * Tests for ArchitectureAnalyzer.
 *
 * Covers all 7 rules: circular dependencies, god modules, dead code,
 * tight coupling, missing abstractions, layer violations, and
 * duplicate functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchitectureAnalyzer } from '../../architecture/analyzer.js';
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

function makeRel(overrides: Partial<Relationship> & Pick<Relationship, 'type' | 'source_id' | 'target_id'>): Relationship {
  return {
    id: nextId(),
    properties: {},
    confidence: 1,
    source: 'test',
    created_at: NOW,
    updated_at: NOW,
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

describe('ArchitectureAnalyzer', () => {
  let analyzer: ArchitectureAnalyzer;

  beforeEach(() => {
    analyzer = new ArchitectureAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('architecture.structural');
    expect(analyzer.name).toBe('Architecture Analyzer');
    expect(analyzer.categories).toContain('architecture');
  });

  // ── Rule 1: Circular Dependencies ──────────────────────────────────

  describe('circular dependencies', () => {
    it('detects a simple A→B→A cycle', async () => {
      const modA = makeEntity({ type: 'module', name: 'moduleA' });
      const modB = makeEntity({ type: 'module', name: 'moduleB' });

      // Relationships: A imports B, B imports A
      const rels: Relationship[] = [
        makeRel({ type: 'imports', source_id: modA.id, target_id: modB.id }),
        makeRel({ type: 'imports', source_id: modB.id, target_id: modA.id }),
      ];

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') {
          return rels.filter((r) => r.source_id === id);
        }
        return rels.filter((r) => r.target_id === id);
      };

      const ctx = makeContext({ module: [modA, modB] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const cycleFindings = findings.filter((f) => f.title.includes('Circular dependency'));
      expect(cycleFindings.length).toBeGreaterThanOrEqual(1);
      expect(cycleFindings[0]!.severity).toBe('high');
    });

    it('produces no cycle finding for acyclic modules', async () => {
      const modA = makeEntity({ type: 'module', name: 'moduleA' });
      const modB = makeEntity({ type: 'module', name: 'moduleB' });

      // A imports B only (no cycle)
      const rels: Relationship[] = [
        makeRel({ type: 'imports', source_id: modA.id, target_id: modB.id }),
      ];

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') return rels.filter((r) => r.source_id === id);
        return rels.filter((r) => r.target_id === id);
      };

      const ctx = makeContext({ module: [modA, modB] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const cycleFindings = findings.filter((f) => f.title.includes('Circular dependency'));
      expect(cycleFindings).toHaveLength(0);
    });

    it('detects A→B→C→A three-node cycle', async () => {
      const modA = makeEntity({ type: 'module', name: 'A' });
      const modB = makeEntity({ type: 'module', name: 'B' });
      const modC = makeEntity({ type: 'module', name: 'C' });

      const rels: Relationship[] = [
        makeRel({ type: 'imports', source_id: modA.id, target_id: modB.id }),
        makeRel({ type: 'imports', source_id: modB.id, target_id: modC.id }),
        makeRel({ type: 'imports', source_id: modC.id, target_id: modA.id }),
      ];

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') return rels.filter((r) => r.source_id === id);
        return rels.filter((r) => r.target_id === id);
      };

      const ctx = makeContext({ module: [modA, modB, modC] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const cycleFindings = findings.filter((f) => f.title.includes('Circular dependency'));
      expect(cycleFindings.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Rule 2: God Modules ────────────────────────────────────────────

  describe('god modules', () => {
    it('detects a module with >15 outgoing dependencies', async () => {
      const godModule = makeEntity({ type: 'module', name: 'god.ts' });

      // Create 16 outgoing 'imports' relationships
      const outRels: Relationship[] = [];
      for (let i = 0; i < 16; i++) {
        outRels.push(
          makeRel({ type: 'imports', source_id: godModule.id, target_id: nextId() }),
        );
      }

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === godModule.id && dir === 'out') return outRels;
        return [];
      };

      const ctx = makeContext(
        { file: [godModule], class: [], module: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const godFindings = findings.filter((f) => f.title.includes('God module'));
      expect(godFindings).toHaveLength(1);
      expect(godFindings[0]!.description).toContain('16');
    });

    it('respects custom threshold from config', async () => {
      const mod = makeEntity({ type: 'file', name: 'small-god.ts' });

      const outRels: Relationship[] = [];
      for (let i = 0; i < 4; i++) {
        outRels.push(
          makeRel({ type: 'imports', source_id: mod.id, target_id: nextId() }),
        );
      }

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === mod.id && dir === 'out') return outRels;
        return [];
      };

      const ctx = makeContext(
        { file: [mod], class: [], module: [] },
        relsFn,
        { god_module_threshold: 3 },
      );
      const findings = await analyzer.analyze(ctx);

      const godFindings = findings.filter((f) => f.title.includes('God module'));
      expect(godFindings).toHaveLength(1);
    });

    it('assigns high severity when deps > 2x threshold', async () => {
      const godModule = makeEntity({ type: 'file', name: 'mega-god.ts' });

      // 31 deps = > 2 * 15
      const outRels: Relationship[] = [];
      for (let i = 0; i < 31; i++) {
        outRels.push(
          makeRel({ type: 'calls', source_id: godModule.id, target_id: nextId() }),
        );
      }

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === godModule.id && dir === 'out') return outRels;
        return [];
      };

      const ctx = makeContext(
        { file: [godModule], class: [], module: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const godFindings = findings.filter((f) => f.title.includes('God module'));
      expect(godFindings).toHaveLength(1);
      expect(godFindings[0]!.severity).toBe('high');
    });

    it('does not flag module under threshold', async () => {
      const mod = makeEntity({ type: 'file', name: 'normal.ts' });

      const outRels: Relationship[] = [];
      for (let i = 0; i < 5; i++) {
        outRels.push(
          makeRel({ type: 'imports', source_id: mod.id, target_id: nextId() }),
        );
      }

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === mod.id && dir === 'out') return outRels;
        return [];
      };

      const ctx = makeContext(
        { file: [mod], class: [], module: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const godFindings = findings.filter((f) => f.title.includes('God module'));
      expect(godFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Dead Code ──────────────────────────────────────────────

  describe('dead code', () => {
    it('detects functions with no callers and no exports', async () => {
      const fn = makeEntity({ type: 'function', name: 'unusedHelper' });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const deadFindings = findings.filter((f) => f.title.includes('dead code'));
      expect(deadFindings).toHaveLength(1);
      expect(deadFindings[0]!.severity).toBe('low');
    });

    it('skips functions that have callers', async () => {
      const fn = makeEntity({ type: 'function', name: 'usedHelper' });
      const callRel = makeRel({
        type: 'calls',
        source_id: nextId(),
        target_id: fn.id,
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === fn.id && dir === 'in') return [callRel];
        return [];
      };

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const deadFindings = findings.filter((f) => f.title.includes('dead code'));
      expect(deadFindings).toHaveLength(0);
    });

    it('skips functions tagged as exported', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'publicApi',
        tags: ['exported'],
      });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const deadFindings = findings.filter((f) => f.title.includes('dead code'));
      expect(deadFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Tight Coupling ─────────────────────────────────────────

  describe('tight coupling', () => {
    it('detects highly unstable modules (I > 0.8 with efferent > 5)', async () => {
      const mod = makeEntity({ type: 'module', name: 'unstable-mod' });

      // 8 outgoing imports, 1 incoming import → I = 8/9 ≈ 0.89
      const outRels: Relationship[] = [];
      for (let i = 0; i < 8; i++) {
        outRels.push(makeRel({ type: 'imports', source_id: mod.id, target_id: nextId() }));
      }
      const inRels: Relationship[] = [
        makeRel({ type: 'imports', source_id: nextId(), target_id: mod.id }),
      ];

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === mod.id && dir === 'out') return outRels;
        if (id === mod.id && dir === 'in') return inRels;
        return [];
      };

      const ctx = makeContext({ module: [mod] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const couplingFindings = findings.filter((f) => f.title.includes('Highly unstable'));
      expect(couplingFindings).toHaveLength(1);
      expect(couplingFindings[0]!.severity).toBe('medium');
    });

    it('detects rigid core modules (high afferent, zero efferent)', async () => {
      const mod = makeEntity({ type: 'module', name: 'core-utils' });

      // 12 incoming imports, 0 outgoing → I = 0
      const inRels: Relationship[] = [];
      for (let i = 0; i < 12; i++) {
        inRels.push(makeRel({ type: 'depends_on', source_id: nextId(), target_id: mod.id }));
      }

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === mod.id && dir === 'in') return inRels;
        if (id === mod.id && dir === 'out') return [];
        return [];
      };

      const ctx = makeContext({ module: [mod] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const rigidFindings = findings.filter((f) => f.title.includes('Rigid core'));
      expect(rigidFindings).toHaveLength(1);
    });

    it('does not flag well-balanced modules', async () => {
      const mod = makeEntity({ type: 'module', name: 'balanced' });

      // 3 out, 3 in → I = 0.5
      const outRels = Array.from({ length: 3 }, () =>
        makeRel({ type: 'imports', source_id: mod.id, target_id: nextId() }),
      );
      const inRels = Array.from({ length: 3 }, () =>
        makeRel({ type: 'imports', source_id: nextId(), target_id: mod.id }),
      );

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === mod.id && dir === 'out') return outRels;
        if (id === mod.id && dir === 'in') return inRels;
        return [];
      };

      const ctx = makeContext({ module: [mod] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const couplingFindings = findings.filter(
        (f) => f.title.includes('unstable') || f.title.includes('Rigid'),
      );
      expect(couplingFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: Missing Abstractions ───────────────────────────────────

  describe('missing abstractions', () => {
    it('detects ≥3 classes in same module without shared interface', async () => {
      const moduleId = nextId();
      const cls1 = makeEntity({ type: 'class', name: 'HandlerA' });
      const cls2 = makeEntity({ type: 'class', name: 'HandlerB' });
      const cls3 = makeEntity({ type: 'class', name: 'HandlerC' });

      const containsRels = [cls1, cls2, cls3].map((cls) =>
        makeRel({ type: 'contains', source_id: moduleId, target_id: cls.id }),
      );

      const relsFn: GetRelsFn = (id, dir) => {
        // in-rels for classes → 'contains' from module
        if (dir === 'in') {
          const rel = containsRels.find((r) => r.target_id === id);
          return rel ? [rel] : [];
        }
        // out-rels for classes → none (no implements/extends)
        return [];
      };

      const ctx = makeContext({ class: [cls1, cls2, cls3] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const absFindings = findings.filter((f) => f.title.includes('Missing shared abstraction'));
      expect(absFindings).toHaveLength(1);
      expect(absFindings[0]!.severity).toBe('medium');
    });

    it('does not flag classes that implement an interface', async () => {
      const moduleId = nextId();
      const cls1 = makeEntity({ type: 'class', name: 'ImplA' });
      const cls2 = makeEntity({ type: 'class', name: 'ImplB' });
      const cls3 = makeEntity({ type: 'class', name: 'ImplC' });
      const interfaceId = nextId();

      const containsRels = [cls1, cls2, cls3].map((cls) =>
        makeRel({ type: 'contains', source_id: moduleId, target_id: cls.id }),
      );
      const implementsRels = [cls1, cls2, cls3].map((cls) =>
        makeRel({ type: 'implements', source_id: cls.id, target_id: interfaceId }),
      );

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'in') {
          const rel = containsRels.find((r) => r.target_id === id);
          return rel ? [rel] : [];
        }
        if (dir === 'out') {
          const rel = implementsRels.find((r) => r.source_id === id);
          return rel ? [rel] : [];
        }
        return [];
      };

      const ctx = makeContext({ class: [cls1, cls2, cls3] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const absFindings = findings.filter((f) => f.title.includes('Missing shared abstraction'));
      expect(absFindings).toHaveLength(0);
    });

    it('does not flag groups with fewer than 3 classes', async () => {
      const moduleId = nextId();
      const cls1 = makeEntity({ type: 'class', name: 'One' });
      const cls2 = makeEntity({ type: 'class', name: 'Two' });

      const containsRels = [cls1, cls2].map((cls) =>
        makeRel({ type: 'contains', source_id: moduleId, target_id: cls.id }),
      );

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'in') {
          const rel = containsRels.find((r) => r.target_id === id);
          return rel ? [rel] : [];
        }
        return [];
      };

      const ctx = makeContext({ class: [cls1, cls2] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const absFindings = findings.filter((f) => f.title.includes('Missing shared abstraction'));
      expect(absFindings).toHaveLength(0);
    });
  });

  // ── Rule 6: Layer Violations ───────────────────────────────────────

  describe('layer violations', () => {
    it('detects infrastructure layer importing from presentation layer', async () => {
      const infraFile = makeEntity({
        type: 'file',
        name: 'db-client.ts',
        tags: ['infrastructure'],
      });
      const uiFile = makeEntity({
        type: 'file',
        name: 'LoginForm.tsx',
        tags: ['ui'],
      });

      const importRel = makeRel({
        type: 'imports',
        source_id: infraFile.id,
        target_id: uiFile.id,
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === infraFile.id && dir === 'out') return [importRel];
        return [];
      };

      const ctx = makeContext(
        { file: [infraFile, uiFile], module: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const layerFindings = findings.filter((f) => f.title.includes('Layer violation'));
      expect(layerFindings).toHaveLength(1);
      expect(layerFindings[0]!.severity).toBe('high');
      expect(layerFindings[0]!.title).toContain('infrastructure');
      expect(layerFindings[0]!.title).toContain('ui');
    });

    it('allows valid downward dependencies (presentation → service)', async () => {
      const uiFile = makeEntity({
        type: 'file',
        name: 'page.tsx',
        tags: ['presentation'],
      });
      const serviceFile = makeEntity({
        type: 'file',
        name: 'user-service.ts',
        tags: ['service'],
      });

      const importRel = makeRel({
        type: 'imports',
        source_id: uiFile.id,
        target_id: serviceFile.id,
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === uiFile.id && dir === 'out') return [importRel];
        return [];
      };

      const ctx = makeContext(
        { file: [uiFile, serviceFile], module: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const layerFindings = findings.filter((f) => f.title.includes('Layer violation'));
      expect(layerFindings).toHaveLength(0);
    });

    it('detects layer from path segments', async () => {
      const dataFile = makeEntity({
        type: 'file',
        name: 'repo.ts',
        source_location: { file: 'src/data/repo.ts' },
      });
      const controllerFile = makeEntity({
        type: 'file',
        name: 'handler.ts',
        source_location: { file: 'src/controller/handler.ts' },
      });

      // data (layer 4) importing controller (layer 1) → violation
      const importRel = makeRel({
        type: 'imports',
        source_id: dataFile.id,
        target_id: controllerFile.id,
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === dataFile.id && dir === 'out') return [importRel];
        return [];
      };

      const ctx = makeContext(
        { file: [dataFile, controllerFile], module: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const layerFindings = findings.filter((f) => f.title.includes('Layer violation'));
      expect(layerFindings).toHaveLength(1);
    });
  });

  // ── Rule 7: Duplicate Functionality ────────────────────────────────

  describe('duplicate functionality', () => {
    it('detects functions with similar normalized names', async () => {
      const fn1 = makeEntity({ type: 'function', name: 'getUser' });
      const fn2 = makeEntity({ type: 'function', name: 'get_user' });

      const ctx = makeContext({ function: [fn1, fn2] });
      const findings = await analyzer.analyze(ctx);

      const dupFindings = findings.filter((f) => f.title.includes('duplicate functionality'));
      expect(dupFindings).toHaveLength(1);
      expect(dupFindings[0]!.severity).toBe('low');
    });

    it('does not flag unique function names', async () => {
      const fn1 = makeEntity({ type: 'function', name: 'createUser' });
      const fn2 = makeEntity({ type: 'function', name: 'deleteOrder' });

      const ctx = makeContext({ function: [fn1, fn2] });
      const findings = await analyzer.analyze(ctx);

      const dupFindings = findings.filter((f) => f.title.includes('duplicate functionality'));
      expect(dupFindings).toHaveLength(0);
    });

    it('skips tiny function names (<3 chars after normalization)', async () => {
      const fn1 = makeEntity({ type: 'function', name: 'go' });
      const fn2 = makeEntity({ type: 'function', name: 'go' });

      const ctx = makeContext({ function: [fn1, fn2] });
      const findings = await analyzer.analyze(ctx);

      const dupFindings = findings.filter((f) => f.title.includes('duplicate functionality'));
      expect(dupFindings).toHaveLength(0);
    });
  });

  // ── Empty graph & lifecycle ────────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('initialize and finalize are no-ops', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });
});
