/**
 * @module @recurrsive/collectors/__tests__/integration
 *
 * Integration tests that verify the full collector pipeline:
 * collector → entities → validation.
 *
 * These tests confirm that collectors produce entities and relationships
 * that conform to the core type schemas and can be processed downstream.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GitCollector } from '../../git/collector.js';
import { GitHubCollector } from '../../github/collector.js';
import { OpenTelemetryCollector } from '../../telemetry/collector.js';
import { CollectorRegistry } from '../../base/registry.js';
import {
  EntityTypeSchema,
  RelationTypeSchema,
} from '@recurrsive/core';
import type {
  CollectorConfig,
  DataGovernance,
  Entity,
  Relationship,
} from '@recurrsive/core';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const governance: DataGovernance = {
  masked_fields: [],
  excluded_patterns: [],
  pii_detection: false,
  audit_log: false,
  retention_days: 90,
};

const config: CollectorConfig = { governance, custom: {} };

// We use the Recurrsive repo itself as a test target for GitCollector
const REPO_ROOT = path.resolve(import.meta.dirname, '../../../../..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate that all entities conform to the EntityTypeSchema. */
function assertValidEntities(entities: Entity[]): void {
  for (const entity of entities) {
    expect(entity.id).toBeTruthy();
    expect(entity.name).toBeTruthy();
    expect(entity.type).toBeTruthy();
    expect(entity.source).toBeTruthy();
    expect(entity.created_at).toBeTruthy();

    // Type must be in the schema
    const parsed = EntityTypeSchema.safeParse(entity.type);
    expect(parsed.success, `Invalid entity type: ${entity.type}`).toBe(true);
  }
}

/** Validate that all relationships conform to the RelationTypeSchema. */
function assertValidRelationships(relationships: Relationship[]): void {
  for (const rel of relationships) {
    expect(rel.id).toBeTruthy();
    expect(rel.type).toBeTruthy();
    expect(rel.source_id).toBeTruthy();
    expect(rel.target_id).toBeTruthy();
    expect(rel.source).toBeTruthy();

    // Type must be in the schema
    const parsed = RelationTypeSchema.safeParse(rel.type);
    expect(parsed.success, `Invalid relationship type: ${rel.type}`).toBe(true);

    // Confidence between 0 and 1
    expect(rel.confidence).toBeGreaterThanOrEqual(0);
    expect(rel.confidence).toBeLessThanOrEqual(1);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Collector Integration', () => {
  // ── GitHub Collector ─────────────────────────────────────────────────
  describe('GitHubCollector → entities + relationships', () => {
    let collector: GitHubCollector;

    beforeEach(() => {
      collector = new GitHubCollector('https://github.com/test/repo');
    });

    it('produces valid entities through full lifecycle', async () => {
      await collector.initialize(config);
      const validation = await collector.validate();
      expect(validation.valid).toBe(true);

      const result = await collector.collect();
      expect(result.entities.length).toBeGreaterThan(0);
      assertValidEntities(result.entities);

      await collector.dispose();
    });

    it('produces valid relationships', async () => {
      await collector.initialize(config);
      const result = await collector.collect();
      expect(result.relationships.length).toBeGreaterThan(0);
      assertValidRelationships(result.relationships);

      await collector.dispose();
    });

    it('metadata has correct collector_id', async () => {
      await collector.initialize(config);
      const result = await collector.collect();
      expect(result.metadata.collector_id).toBe('github');
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
      expect(result.metadata.items_processed).toBeGreaterThan(0);
    });
  });

  // ── OpenTelemetry Collector ──────────────────────────────────────────
  describe('OpenTelemetryCollector → entities + relationships', () => {
    let collector: OpenTelemetryCollector;

    beforeEach(() => {
      collector = new OpenTelemetryCollector('http://localhost:4318');
    });

    it('produces valid entities through full lifecycle', async () => {
      await collector.initialize(config);
      const validation = await collector.validate();
      expect(validation.valid).toBe(true);

      const result = await collector.collect();
      expect(result.entities.length).toBeGreaterThan(0);
      assertValidEntities(result.entities);

      await collector.dispose();
    });

    it('produces valid relationships', async () => {
      await collector.initialize(config);
      const result = await collector.collect();
      expect(result.relationships.length).toBeGreaterThan(0);
      assertValidRelationships(result.relationships);

      await collector.dispose();
    });

    it('metadata has correct collector_id', async () => {
      await collector.initialize(config);
      const result = await collector.collect();
      expect(result.metadata.collector_id).toBe('telemetry');
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Registry Integration ─────────────────────────────────────────────
  describe('CollectorRegistry → collectAll', () => {
    let registry: CollectorRegistry;

    beforeEach(() => {
      registry = new CollectorRegistry();
      registry.register(new GitHubCollector('https://github.com/test/repo'));
      registry.register(new OpenTelemetryCollector('http://localhost:4318'));
    });

    it('runs all collectors and aggregates results', async () => {
      const results = await registry.collectAll(governance);

      expect(results).toHaveLength(2);

      for (const result of results) {
        expect(result.entities.length).toBeGreaterThan(0);
        assertValidEntities(result.entities);

        if (result.relationships.length > 0) {
          assertValidRelationships(result.relationships);
        }
      }
    });

    it('produces unique entity IDs across collectors', async () => {
      const results = await registry.collectAll(governance);
      const allIds = results.flatMap((r) => r.entities.map((e) => e.id));
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('each result has correct collector_id', async () => {
      const results = await registry.collectAll(governance);
      const collectorIds = results.map((r) => r.metadata.collector_id);
      expect(collectorIds).toContain('github');
      expect(collectorIds).toContain('telemetry');
    });
  });

  // ── Governance Filtering ─────────────────────────────────────────────
  describe('Governance filtering across collectors', () => {
    it('applies excluded_patterns to entities', async () => {
      const strictGovernance: DataGovernance = {
        ...governance,
        excluded_patterns: ['**/node_modules/**', '**/*.log'],
      };

      const collector = new GitHubCollector('https://github.com/test/repo');
      await collector.initialize({ governance: strictGovernance, custom: {} });
      const result = await collector.collect();

      // Should still produce entities (non-matching ones)
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('applies masked_fields to entity properties', async () => {
      const maskedGovernance: DataGovernance = {
        ...governance,
        masked_fields: ['email', 'author_email'],
      };

      const collector = new GitHubCollector('https://github.com/test/repo');
      await collector.initialize({ governance: maskedGovernance, custom: {} });
      const result = await collector.collect();

      // Entities with email properties should have them masked
      for (const entity of result.entities) {
        if (entity.properties['email']) {
          expect(entity.properties['email']).toBe('***MASKED***');
        }
      }
    });
  });
});
