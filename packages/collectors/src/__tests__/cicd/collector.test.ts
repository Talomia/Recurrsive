/**
 * Tests for the CICDCollector.
 *
 * Tests cover:
 * - GitHub Actions workflow discovery and parsing
 * - Job/step entity creation
 * - Job dependency (needs) relationship creation
 * - GitLab CI detection
 * - Empty project handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CICDCollector } from '../../cicd/collector.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recurrsive-cicd-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// GitHub Actions
// ---------------------------------------------------------------------------

describe('GitHub Actions parsing', () => {
  it('discovers and parses a workflow file', async () => {
    const workflowDir = path.join(tmpDir, '.github', 'workflows');
    await fs.mkdir(workflowDir, { recursive: true });

    await fs.writeFile(
      path.join(workflowDir, 'ci.yml'),
      `name: CI Pipeline
on:
  push:
  pull_request:

env:
  NODE_ENV: test

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Run lint
        run: npm run lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Install
        run: npm ci
      - name: Test
        run: npm test

  deploy:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - name: Deploy
        run: echo "Deploying..."
`,
    );

    const collector = new CICDCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    // Should have: 1 workflow + 3 jobs + steps
    const workflows = result.entities.filter((e) => e.type === 'workflow');
    expect(workflows.length).toBe(1);
    expect(workflows[0]!.properties['triggers']).toEqual(expect.arrayContaining(['push', 'pull_request']));
    expect(workflows[0]!.properties['job_count']).toBe(3);

    const jobs = result.entities.filter((e) => e.type === 'job');
    expect(jobs.length).toBe(3);

    const steps = result.entities.filter((e) => e.type === 'step');
    expect(steps.length).toBeGreaterThanOrEqual(4);

    // Check contains relationships (workflow → jobs)
    const containsFromWorkflow = result.relationships.filter(
      (r) => r.type === 'contains' && r.source_id === workflows[0]!.id,
    );
    expect(containsFromWorkflow.length).toBe(3);

    // Check depends_on relationships
    const dependsOn = result.relationships.filter((r) => r.type === 'depends_on');
    expect(dependsOn.length).toBeGreaterThanOrEqual(2);

    await collector.dispose();
  });

  it('parses block-form needs lists as dependencies, not steps', async () => {
    const workflowDir = path.join(tmpDir, '.github', 'workflows');
    await fs.mkdir(workflowDir, { recursive: true });

    await fs.writeFile(
      path.join(workflowDir, 'deploy.yml'),
      `name: Deploy
on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Build
        run: npm run build

  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: npm test

  deploy:
    runs-on: ubuntu-latest
    needs:
      - build
      - test
    steps:
      - name: Deploy
        run: echo "Deploying..."
`,
    );

    const collector = new CICDCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const deployJob = result.entities.find(
      (e) => e.type === 'job' && e.name === 'gha.Deploy.deploy',
    );
    expect(deployJob).toBeDefined();
    // The block-form needs list is captured as dependencies…
    expect(deployJob!.properties['needs']).toEqual(['build', 'test']);
    // …and its dash items are not miscounted as steps.
    expect(deployJob!.properties['step_count']).toBe(1);

    const jobIds = new Map(
      result.entities.filter((e) => e.type === 'job').map((e) => [e.name, e.id]),
    );
    const dependsOn = result.relationships.filter(
      (r) => r.type === 'depends_on' && r.source_id === jobIds.get('gha.Deploy.deploy'),
    );
    const targets = dependsOn.map((r) => r.target_id).sort();
    expect(targets).toEqual(
      [jobIds.get('gha.Deploy.build'), jobIds.get('gha.Deploy.test')].sort(),
    );

    await collector.dispose();
  });

  it('splits inline on: arrays into individual triggers', async () => {
    const workflowDir = path.join(tmpDir, '.github', 'workflows');
    await fs.mkdir(workflowDir, { recursive: true });

    await fs.writeFile(
      path.join(workflowDir, 'inline.yml'),
      `name: Inline Triggers
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Build
        run: npm run build
`,
    );

    const collector = new CICDCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const workflow = result.entities.find((e) => e.type === 'workflow');
    expect(workflow).toBeDefined();
    // The inline array form must be split into real trigger names, not
    // recorded as a single malformed "[push, pull_request]" trigger.
    expect(workflow!.properties['triggers']).toEqual(['push', 'pull_request']);

    await collector.dispose();
  });

  it('applies governance exclusion patterns to workflow files', async () => {
    const workflowDir = path.join(tmpDir, '.github', 'workflows');
    await fs.mkdir(workflowDir, { recursive: true });

    await fs.writeFile(
      path.join(workflowDir, 'secret-deploy.yml'),
      `name: Secret Deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
`,
    );

    const collector = new CICDCollector(tmpDir);
    await collector.initialize({
      governance: {
        masked_fields: [],
        excluded_patterns: ['.github/workflows/secret-*.yml'],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: {},
    });

    const result = await collector.collect();
    expect(result.entities.length).toBe(0);

    await collector.dispose();
  });

  it('handles no workflows gracefully', async () => {
    const collector = new CICDCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    expect(result.entities.length).toBe(0);
    expect(result.relationships.length).toBe(0);

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// GitLab CI
// ---------------------------------------------------------------------------

describe('GitLab CI detection', () => {
  it('detects .gitlab-ci.yml', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.gitlab-ci.yml'),
      `stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - npm ci
    - npm run build

test:
  stage: test
  script:
    - npm test
`,
    );

    const collector = new CICDCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const pipeline = result.entities.find((e) => e.type === 'pipeline');
    expect(pipeline).toBeDefined();
    expect(pipeline!.properties['source']).toBe('gitlab-ci');
    expect(pipeline!.properties['has_stages']).toBe(true);

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// Validation & Metadata
// ---------------------------------------------------------------------------

describe('Validation and metadata', () => {
  it('validates accessible path', async () => {
    const collector = new CICDCollector(tmpDir);
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects inaccessible path', async () => {
    const collector = new CICDCollector('/nonexistent/path/42');
    const result = await collector.validate();
    expect(result.valid).toBe(false);
  });

  it('has correct metadata', () => {
    const collector = new CICDCollector(tmpDir);
    expect(collector.id).toBe('cicd');
    expect(collector.name).toBe('CI/CD Collector');
    expect(collector.version).toBe('0.1.0');
  });

  it('returns timing metadata', async () => {
    const collector = new CICDCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('cicd');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.items_processed).toBe(0);

    await collector.dispose();
  });
});
