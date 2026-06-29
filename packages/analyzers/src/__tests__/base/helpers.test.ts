/**
 * Tests for analyzer helper functions: createFinding, createEvidence,
 * locationFromEntity.
 *
 * Verifies that factory functions produce valid objects with
 * auto-generated IDs and timestamps, and that defaults are applied.
 */

import { describe, it, expect } from 'vitest';
import {
  createFinding,
  createEvidence,
  locationFromEntity,
} from '../../base/helpers.js';
import type { Entity } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// createFinding
// ---------------------------------------------------------------------------

describe('createFinding', () => {
  it('produces a valid Finding with auto-generated id', () => {
    const finding = createFinding({
      analyzer_id: 'test.analyzer',
      title: 'Test Finding',
      description: 'A test finding',
      severity: 'medium',
      category: 'architecture',
      evidence: [],
      locations: [],
      confidence: 0.8,
      tags: ['test'],
    });

    expect(finding.id).toBeDefined();
    expect(finding.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('auto-generates a created_at timestamp', () => {
    const finding = createFinding({
      analyzer_id: 'test',
      title: 'Test',
      description: 'Test',
      severity: 'low',
      category: 'security',
      evidence: [],
      locations: [],
      confidence: 0.5,
      tags: [],
    });

    expect(finding.created_at).toBeDefined();
    // Should be a valid ISO string
    expect(() => new Date(finding.created_at)).not.toThrow();
    expect(new Date(finding.created_at).toISOString()).toBe(finding.created_at);
  });

  it('copies all provided fields correctly', () => {
    const finding = createFinding({
      analyzer_id: 'security.xss',
      title: 'XSS Vulnerability',
      description: 'Found XSS in login form',
      severity: 'critical',
      category: 'security',
      evidence: [],
      locations: [{ file: 'src/login.ts' }],
      confidence: 0.95,
      tags: ['xss', 'security'],
      suggested_fix: 'Sanitize input',
      metadata: { line: 42 },
    });

    expect(finding.analyzer_id).toBe('security.xss');
    expect(finding.title).toBe('XSS Vulnerability');
    expect(finding.description).toBe('Found XSS in login form');
    expect(finding.severity).toBe('critical');
    expect(finding.category).toBe('security');
    expect(finding.locations).toHaveLength(1);
    expect(finding.locations[0]!.file).toBe('src/login.ts');
    expect(finding.confidence).toBe(0.95);
    expect(finding.tags).toEqual(['xss', 'security']);
    expect(finding.suggested_fix).toBe('Sanitize input');
    expect(finding.metadata).toEqual({ line: 42 });
  });

  it('applies undefined for optional fields when not provided', () => {
    const finding = createFinding({
      analyzer_id: 'test',
      title: 'Test',
      description: 'Test',
      severity: 'info',
      category: 'performance',
      evidence: [],
      locations: [],
      confidence: 0.5,
      tags: [],
    });

    expect(finding.suggested_fix).toBeUndefined();
    expect(finding.metadata).toBeUndefined();
  });

  it('generates unique IDs for each call', () => {
    const opts = {
      analyzer_id: 'test',
      title: 'Test',
      description: 'Test',
      severity: 'medium' as const,
      category: 'architecture' as const,
      evidence: [],
      locations: [],
      confidence: 0.5,
      tags: [],
    };

    const finding1 = createFinding(opts);
    const finding2 = createFinding(opts);
    expect(finding1.id).not.toBe(finding2.id);
  });

  it('handles empty evidence and locations arrays', () => {
    const finding = createFinding({
      analyzer_id: 'test',
      title: 'Test',
      description: 'Test',
      severity: 'low',
      category: 'cost',
      evidence: [],
      locations: [],
      confidence: 0.3,
      tags: [],
    });

    expect(finding.evidence).toEqual([]);
    expect(finding.locations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createEvidence
// ---------------------------------------------------------------------------

describe('createEvidence', () => {
  it('produces a valid Evidence with auto-generated id', () => {
    const evidence = createEvidence({
      type: 'code',
      source: 'test-analyzer',
      description: 'Found in source code',
      entity_ids: [],
      confidence: 0.9,
    });

    expect(evidence.id).toBeDefined();
    expect(evidence.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('auto-generates a collected_at timestamp', () => {
    const evidence = createEvidence({
      type: 'metric',
      source: 'prometheus',
      description: 'CPU usage spike',
      entity_ids: [],
      confidence: 0.85,
    });

    expect(evidence.collected_at).toBeDefined();
    expect(() => new Date(evidence.collected_at)).not.toThrow();
  });

  it('copies all provided fields correctly', () => {
    const evidence = createEvidence({
      type: 'telemetry',
      source: 'datadog',
      description: 'Latency p99 > 500ms',
      entity_ids: ['00000000-0000-4000-8000-000000000001'],
      confidence: 0.92,
      data: { p99: 520, p50: 100 },
    });

    expect(evidence.type).toBe('telemetry');
    expect(evidence.source).toBe('datadog');
    expect(evidence.description).toBe('Latency p99 > 500ms');
    expect(evidence.entity_ids).toEqual(['00000000-0000-4000-8000-000000000001']);
    expect(evidence.confidence).toBe(0.92);
    expect(evidence.data).toEqual({ p99: 520, p50: 100 });
  });

  it('applies undefined for optional data when not provided', () => {
    const evidence = createEvidence({
      type: 'log',
      source: 'app',
      description: 'Error rate increase',
      entity_ids: [],
      confidence: 0.7,
    });

    expect(evidence.data).toBeUndefined();
  });

  it('generates unique IDs for each call', () => {
    const opts = {
      type: 'code' as const,
      source: 'test',
      description: 'Test',
      entity_ids: [],
      confidence: 0.5,
    };

    const e1 = createEvidence(opts);
    const e2 = createEvidence(opts);
    expect(e1.id).not.toBe(e2.id);
  });

  it('supports all evidence types', () => {
    const types = [
      'code', 'telemetry', 'metric', 'trace', 'log',
      'test', 'review', 'ticket', 'benchmark', 'historical', 'simulation',
    ] as const;

    for (const type of types) {
      const evidence = createEvidence({
        type,
        source: 'test',
        description: 'Test',
        entity_ids: [],
        confidence: 0.5,
      });
      expect(evidence.type).toBe(type);
    }
  });
});

// ---------------------------------------------------------------------------
// locationFromEntity
// ---------------------------------------------------------------------------

describe('locationFromEntity', () => {
  function makeEntity(overrides: Partial<Entity> = {}): Entity {
    const now = new Date().toISOString();
    return {
      id: '00000000-0000-4000-8000-000000000001',
      type: 'function',
      name: 'testFunction',
      qualified_name: 'repo:src/index.ts:testFunction',
      source: 'code-collector',
      properties: {},
      tags: [],
      created_at: now,
      updated_at: now,
      last_seen_at: now,
      ...overrides,
    };
  }

  it('extracts file from entity source_location', () => {
    const entity = makeEntity({
      source_location: { file: 'src/index.ts' },
    });

    const loc = locationFromEntity(entity);
    expect(loc).toBeDefined();
    expect(loc!.file).toBe('src/index.ts');
  });

  it('extracts start_line and end_line', () => {
    const entity = makeEntity({
      source_location: {
        file: 'src/utils.ts',
        start_line: 10,
        end_line: 25,
      },
    });

    const loc = locationFromEntity(entity);
    expect(loc!.start_line).toBe(10);
    expect(loc!.end_line).toBe(25);
  });

  it('extracts column information', () => {
    const entity = makeEntity({
      source_location: {
        file: 'src/app.ts',
        start_line: 5,
        end_line: 5,
        start_column: 3,
        end_column: 20,
      },
    });

    const loc = locationFromEntity(entity);
    expect(loc!.start_column).toBe(3);
    expect(loc!.end_column).toBe(20);
  });

  it('extracts repository and commit', () => {
    const entity = makeEntity({
      source_location: {
        file: 'src/main.ts',
        repository: 'github.com/example/repo',
        commit: 'abc123',
      },
    });

    const loc = locationFromEntity(entity);
    expect(loc!.repository).toBe('github.com/example/repo');
    expect(loc!.commit).toBe('abc123');
  });

  it('returns undefined when entity has no source_location', () => {
    const entity = makeEntity({ source_location: undefined });
    const loc = locationFromEntity(entity);
    expect(loc).toBeUndefined();
  });

  it('returns undefined when source_location has no file', () => {
    const entity = makeEntity({
      source_location: {
        // file is optional in the schema, and undefined/missing
        start_line: 10,
      },
    });
    const loc = locationFromEntity(entity);
    expect(loc).toBeUndefined();
  });

  it('handles minimal source_location with only file', () => {
    const entity = makeEntity({
      source_location: { file: 'package.json' },
    });

    const loc = locationFromEntity(entity);
    expect(loc).toBeDefined();
    expect(loc!.file).toBe('package.json');
    expect(loc!.start_line).toBeUndefined();
    expect(loc!.end_line).toBeUndefined();
    expect(loc!.start_column).toBeUndefined();
    expect(loc!.end_column).toBeUndefined();
    expect(loc!.repository).toBeUndefined();
    expect(loc!.commit).toBeUndefined();
  });
});
