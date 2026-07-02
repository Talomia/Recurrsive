/**
 * @module __tests__/resolvers/cross-file
 *
 * Tests for the CrossFileResolver — verifying that import references
 * are resolved across files and linked to concrete entities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossFileResolver } from '../../resolvers/cross-file.js';
import type { ResolvedReference } from '../../resolvers/cross-file.js';
import type { ExtractedEntity, ImportInfo } from '../../extractors/base.js';
import type { EntityType, RelationType } from '@recurrsive/core';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntity(
  name: string,
  file: string,
  overrides: Partial<ExtractedEntity> = {},
): ExtractedEntity {
  return {
    type: (overrides.type ?? 'function') as EntityType,
    name,
    qualified_name: overrides.qualified_name ?? `${file}:${name}`,
    properties: overrides.properties ?? { is_exported: true },
    source_location: {
      file,
      start_line: 1,
      end_line: 10,
      start_column: 0,
      end_column: 0,
    },
    relationships: overrides.relationships ?? [],
  };
}

function makeImport(
  module: string,
  names: string[],
  file: string,
  overrides: Partial<ImportInfo> = {},
): ImportInfo {
  return {
    module,
    names,
    is_default: overrides.is_default ?? false,
    is_namespace: overrides.is_namespace ?? false,
    source_location: { file, line: 1 },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CrossFileResolver', () => {
  let resolver: CrossFileResolver;

  beforeEach(() => {
    resolver = new CrossFileResolver();
  });

  // ── Basic construction ─────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates a resolver instance', () => {
      expect(resolver).toBeDefined();
      expect(resolver).toBeInstanceOf(CrossFileResolver);
    });
  });

  // ── resolve ────────────────────────────────────────────────────────────

  describe('resolve', () => {
    it('returns empty array when no imports exist', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [makeEntity('helper', 'src/utils.ts')]);

      const imports = new Map<string, ImportInfo[]>();
      // No imports

      const result = resolver.resolve(entities, imports);
      expect(result).toEqual([]);
    });

    it('returns empty array when no entities exist', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['helper'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result).toEqual([]);
    });

    it('resolves a simple cross-file import', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('helper', 'src/utils.ts'),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts', {
          relationships: [
            { type: 'calls' as RelationType, target_name: 'helper' },
          ],
        }),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['helper'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result.length).toBeGreaterThan(0);

      const ref = result[0]!;
      expect(ref.source_file).toBe('src/main.ts');
      expect(ref.target_entity).toBe('src/utils.ts:helper');
      expect(ref.relationship_type).toBe('imports');
    });

    it('creates file-level import when no entity uses the symbol', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('helper', 'src/utils.ts'),
      ]);
      // main.ts has no entities that reference 'helper' in relationships
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['helper'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result.length).toBeGreaterThan(0);

      // Should fall back to file-level import
      const ref = result[0]!;
      expect(ref.source_file).toBe('src/main.ts');
      expect(ref.source_entity).toBe('src/main.ts'); // file-level
      expect(ref.target_entity).toBe('src/utils.ts:helper');
    });

    it('handles multiple imports from different files', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('helperA', 'src/utils.ts'),
        makeEntity('helperB', 'src/utils.ts'),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['helperA', 'helperB'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      // Should resolve both imports
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('skips imports that do not match any exported entity', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('helper', 'src/utils.ts'),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['nonExistentSymbol'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      // nonExistentSymbol doesn't exist in the export index
      expect(result).toEqual([]);
    });

    it('only indexes exported entities', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('privateHelper', 'src/utils.ts', {
          properties: { is_exported: false },
        }),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['privateHelper'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result).toEqual([]);
    });

    it('prefers candidates from the resolved module path', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      // Same symbol name in two different files
      entities.set('src/utils.ts', [
        makeEntity('format', 'src/utils.ts'),
      ]);
      entities.set('lib/helpers.ts', [
        makeEntity('format', 'lib/helpers.ts'),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['format'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result.length).toBeGreaterThan(0);

      // Should prefer src/utils.ts since the import path resolves there
      const ref = result[0]!;
      expect(ref.target_file).toBe('src/utils.ts');
    });

    it('handles non-relative imports', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('node_modules/express/index.ts', [
        makeEntity('Router', 'node_modules/express/index.ts'),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('express', ['Router'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      // May or may not resolve depending on the module index matching
      // The important thing is it doesn't throw
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles entities with exports relationship type', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('helper', 'src/utils.ts', {
          properties: {},
          relationships: [
            { type: 'exports' as RelationType, target_name: 'helper' },
          ],
        }),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['helper'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      // Entity should be indexed because it has an 'exports' relationship
      expect(result.length).toBeGreaterThan(0);
    });

    it('links entities that reference the imported symbol', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('format', 'src/utils.ts'),
      ]);
      entities.set('src/main.ts', [
        makeEntity('processData', 'src/main.ts', {
          relationships: [
            { type: 'calls' as RelationType, target_name: 'format' },
          ],
        }),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['format'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result.length).toBeGreaterThan(0);

      // Should link processData → format
      const ref = result.find((r) => r.source_entity === 'src/main.ts:processData');
      expect(ref).toBeDefined();
      expect(ref!.target_entity).toBe('src/utils.ts:format');
    });

    it('handles dotted target_name references', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('Utils', 'src/utils.ts'),
      ]);
      entities.set('src/main.ts', [
        makeEntity('main', 'src/main.ts', {
          relationships: [
            {
              type: 'calls' as RelationType,
              target_name: 'namespace.Utils',
            },
          ],
        }),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['Utils'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty maps gracefully', () => {
      const result = resolver.resolve(
        new Map<string, ExtractedEntity[]>(),
        new Map<string, ImportInfo[]>(),
      );
      expect(result).toEqual([]);
    });

    it('handles files with no entities but with imports', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('helper', 'src/utils.ts'),
      ]);
      // main.ts exists as a key but has no entities
      entities.set('src/main.ts', []);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/main.ts', [
        makeImport('./utils', ['helper'], 'src/main.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      // Should create file-level import since no entities to link
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.source_entity).toBe('src/main.ts');
    });

    it('handles parent-directory relative imports', () => {
      const entities = new Map<string, ExtractedEntity[]>();
      entities.set('src/utils.ts', [
        makeEntity('helper', 'src/utils.ts'),
      ]);
      entities.set('src/handlers/api.ts', [
        makeEntity('apiHandler', 'src/handlers/api.ts'),
      ]);

      const imports = new Map<string, ImportInfo[]>();
      imports.set('src/handlers/api.ts', [
        makeImport('../utils', ['helper'], 'src/handlers/api.ts'),
      ]);

      const result = resolver.resolve(entities, imports);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.target_file).toBe('src/utils.ts');
    });
  });
});
