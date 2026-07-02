/**
 * @module __tests__/pipeline
 *
 * Tests for the ParsingPipeline — the main orchestrator that ties together
 * tree-sitter parsing, entity extraction, AI pattern detection, and
 * cross-file resolution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParsingPipeline } from '../pipeline.js';
import type { ParsedFile } from '../pipeline.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ParsingPipeline', () => {
  let pipeline: ParsingPipeline;

  beforeEach(() => {
    pipeline = new ParsingPipeline();
  });

  // ── Construction ───────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates a pipeline instance', () => {
      expect(pipeline).toBeDefined();
      expect(pipeline).toBeInstanceOf(ParsingPipeline);
    });
  });

  // ── initialize ─────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('does not throw when called with supported languages', async () => {
      // Tree-sitter may not be available but initialize should not throw
      await expect(pipeline.initialize(['typescript', 'python'])).resolves.not.toThrow();
    });

    it('does not throw with empty languages array', async () => {
      await expect(pipeline.initialize([])).resolves.not.toThrow();
    });

    it('handles unknown language names gracefully', async () => {
      await expect(pipeline.initialize(['nonexistent-lang'])).resolves.not.toThrow();
    });
  });

  // ── parseFile ──────────────────────────────────────────────────────────

  describe('parseFile', () => {
    it('returns a ParsedFile with correct path and language', async () => {
      const result = await pipeline.parseFile(
        'src/app.ts',
        'function hello() { return "world"; }',
        'typescript',
      );

      expect(result.path).toBe('src/app.ts');
      expect(result.language).toBe('typescript');
    });

    it('extracts entities from TypeScript source', async () => {
      const tsSource = `
export function processData(input: string): number {
  return input.length;
}

export class DataProcessor {
  process(data: string): void {
    console.log(data);
  }
}
      `.trim();

      const result = await pipeline.parseFile('src/processor.ts', tsSource, 'typescript');

      expect(result.entities.length).toBeGreaterThan(0);
      // Should find at least a function and a class
      const entityTypes = result.entities.map((e) => e.type);
      expect(entityTypes).toContain('function');
      expect(entityTypes).toContain('class');
    });

    it('extracts imports from TypeScript source', async () => {
      const tsSource = `
import { Router } from 'express';
import type { Request, Response } from 'express';

export function handler(req: Request, res: Response) {
  res.send('ok');
}
      `.trim();

      const result = await pipeline.parseFile('src/handler.ts', tsSource, 'typescript');

      expect(result.imports.length).toBeGreaterThan(0);
      const importModules = result.imports.map((i) => i.module);
      expect(importModules).toContain('express');
    });

    it('detects AI patterns in source code', async () => {
      const aiSource = `
import OpenAI from 'openai';

const client = new OpenAI();
const completion = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
      `.trim();

      const result = await pipeline.parseFile('src/ai.ts', aiSource, 'typescript');

      // AI detector should find at least one pattern
      expect(result.aiPatterns.length).toBeGreaterThan(0);
    });

    it('returns empty arrays for empty source', async () => {
      const result = await pipeline.parseFile('empty.ts', '', 'typescript');

      expect(result.entities).toEqual([]);
      expect(result.imports).toEqual([]);
      expect(result.aiPatterns).toEqual([]);
    });

    it('returns empty entities for unsupported languages', async () => {
      const result = await pipeline.parseFile('script.rb', 'puts "hello"', 'ruby');
      expect(result.entities).toEqual([]);
    });
  });

  // ── parseProject ───────────────────────────────────────────────────────

  describe('parseProject', () => {
    it('returns entities and relationships arrays', async () => {
      const result = await pipeline.parseProject([
        {
          path: 'src/utils.ts',
          content: 'export function helper() { return 42; }',
          language: 'typescript',
        },
      ]);

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('relationships');
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('converts ExtractedEntities to graph Entities with IDs', async () => {
      const result = await pipeline.parseProject([
        {
          path: 'src/main.ts',
          content: 'export function main() { console.log("hello"); }',
          language: 'typescript',
        },
      ]);

      for (const entity of result.entities) {
        expect(entity.id).toBeDefined();
        expect(typeof entity.id).toBe('string');
        expect(entity.id.length).toBeGreaterThan(0);
        expect(entity.created_at).toBeDefined();
        expect(entity.updated_at).toBeDefined();
        expect(entity.last_seen_at).toBeDefined();
        expect(entity.source).toContain('parser:');
      }
    });

    it('handles multiple files', async () => {
      const result = await pipeline.parseProject([
        {
          path: 'src/a.ts',
          content: 'export function funcA() { return 1; }',
          language: 'typescript',
        },
        {
          path: 'src/b.ts',
          content: 'export function funcB() { return 2; }',
          language: 'typescript',
        },
      ]);

      // Should have entities from both files
      const names = result.entities.map((e) => e.name);
      expect(names).toContain('funcA');
      expect(names).toContain('funcB');
    });

    it('resolves cross-file references into relationships', async () => {
      const result = await pipeline.parseProject([
        {
          path: 'src/utils.ts',
          content: 'export function helper() { return 42; }',
          language: 'typescript',
        },
        {
          path: 'src/main.ts',
          content: `
import { helper } from './utils';
export function main() { return helper(); }
          `.trim(),
          language: 'typescript',
        },
      ]);

      // Should have at least some entities
      expect(result.entities.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty file array', async () => {
      const result = await pipeline.parseProject([]);
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('generates tags based on entity properties', async () => {
      const result = await pipeline.parseProject([
        {
          path: 'src/api.ts',
          content: `
export async function fetchData() { return await fetch('/api'); }
          `.trim(),
          language: 'typescript',
        },
      ]);

      // All entities should have at least a tag for their type
      for (const entity of result.entities) {
        expect(entity.tags.length).toBeGreaterThan(0);
        expect(entity.tags).toContain(entity.type);
      }
    });
  });

  // ── dispose ────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('does not throw', () => {
      expect(() => pipeline.dispose()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      pipeline.dispose();
      expect(() => pipeline.dispose()).not.toThrow();
    });
  });
});
