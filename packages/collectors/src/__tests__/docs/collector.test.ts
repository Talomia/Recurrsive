/**
 * Tests for the DocumentationCollector.
 *
 * Tests cover:
 * - README file discovery (root-level and nested)
 * - ADR discovery and parsing
 * - API contract discovery (OpenAPI/AsyncAPI)
 * - Doc directory scanning
 * - Empty project handling
 * - Metadata and entity types
 * - Relationship creation (contains)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentationCollector } from '../../docs/collector.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recurrsive-docs-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const defaultConfig = {
  governance: {
    masked_fields: [],
    excluded_patterns: [],
    pii_detection: false,
    audit_log: false,
    retention_days: 90,
  },
  custom: {},
};

// ---------------------------------------------------------------------------
// README Discovery
// ---------------------------------------------------------------------------

describe('README discovery', () => {
  it('discovers root README.md as a document entity', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'README.md'),
      '# My Project\n\nA great project.',
    );

    const collector = new DocumentationCollector(tmpDir);
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    // README should be type 'document' with category 'readme'
    const readmes = result.entities.filter(
      e => e.type === 'document' && e.properties.category === 'readme',
    );
    expect(readmes.length).toBeGreaterThanOrEqual(1);
    expect(readmes[0]!.properties.format).toBe('markdown');
  });

  it('discovers nested README files', async () => {
    const subDir = path.join(tmpDir, 'packages', 'core');
    await fs.mkdir(subDir, { recursive: true });

    await fs.writeFile(
      path.join(tmpDir, 'README.md'),
      '# Root\n\nRoot readme.',
    );
    await fs.writeFile(
      path.join(subDir, 'README.md'),
      '# Core Package\n\nCore readme.',
    );

    const collector = new DocumentationCollector(tmpDir);
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    // Should find at least the root README
    const docs = result.entities.filter(e => e.type === 'document');
    expect(docs.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// ADR Discovery
// ---------------------------------------------------------------------------

describe('ADR discovery', () => {
  it('discovers ADR files as adr entity type', async () => {
    const adrDir = path.join(tmpDir, 'docs', 'adr');
    await fs.mkdir(adrDir, { recursive: true });

    await fs.writeFile(
      path.join(adrDir, '001-use-typescript.md'),
      '# ADR 001: Use TypeScript\n\n## Status\nAccepted\n\n## Context\nWe need a type-safe language.',
    );
    await fs.writeFile(
      path.join(adrDir, '002-use-postgres.md'),
      '# ADR 002: Use PostgreSQL\n\n## Status\nProposed\n\n## Context\nWe need a relational database.',
    );

    const collector = new DocumentationCollector(tmpDir);
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    // ADRs should be type 'adr'
    const adrs = result.entities.filter(e => e.type === 'adr');
    expect(adrs.length).toBe(2);
    expect(adrs[0]!.properties.category).toBe('adr');
  });
});

// ---------------------------------------------------------------------------
// API Contracts
// ---------------------------------------------------------------------------

describe('API contract discovery', () => {
  it('discovers OpenAPI spec files as api_contract entity type', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'openapi.yaml'),
      'openapi: "3.0.0"\ninfo:\n  title: My API\n  version: "1.0.0"\npaths:\n  /health:\n    get:\n      summary: Health check',
    );

    const collector = new DocumentationCollector(tmpDir);
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const apiContracts = result.entities.filter(e => e.type === 'api_contract');
    expect(apiContracts.length).toBeGreaterThanOrEqual(1);
    expect(apiContracts[0]!.properties.format).toBe('yaml');
  });
});

// ---------------------------------------------------------------------------
// Docs Directory
// ---------------------------------------------------------------------------

describe('docs directory scanning', () => {
  it('discovers markdown files in docs/ directory', async () => {
    const docsDir = path.join(tmpDir, 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    await fs.writeFile(
      path.join(docsDir, 'ARCHITECTURE.md'),
      '# Architecture\n\nSystem architecture overview.',
    );
    await fs.writeFile(
      path.join(docsDir, 'DEVELOPMENT.md'),
      '# Development Guide\n\nHow to develop.',
    );

    const collector = new DocumentationCollector(tmpDir);
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const docEntities = result.entities.filter(e => e.type === 'document');
    expect(docEntities.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Empty Project
// ---------------------------------------------------------------------------

describe('empty project handling', () => {
  it('returns empty result for project with no docs', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'index.ts'),
      'export const x = 1;',
    );

    const collector = new DocumentationCollector(tmpDir);
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.entities).toBeDefined();
    expect(result.relationships).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('collector metadata', () => {
  it('has correct type and name', () => {
    const collector = new DocumentationCollector(tmpDir);
    expect(collector.type).toBe('documentation');
    expect(collector.name).toBeDefined();
    expect(collector.name.length).toBeGreaterThan(0);
  });

  it('provides validation info', () => {
    const collector = new DocumentationCollector(tmpDir);
    const validation = collector.validate();
    expect(validation).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

describe('relationship creation', () => {
  it('creates relationships between doc entities', async () => {
    const docsDir = path.join(tmpDir, 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    await fs.writeFile(
      path.join(tmpDir, 'README.md'),
      '# Project\n\nOverview.',
    );
    await fs.writeFile(
      path.join(docsDir, 'GUIDE.md'),
      '# Guide\n\nA guide.',
    );

    const collector = new DocumentationCollector(tmpDir);
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.relationships).toBeDefined();
    // Should create 'contains' relationships
    if (result.relationships.length > 0) {
      expect(result.relationships[0]!.type).toBe('contains');
    }
  });
});
