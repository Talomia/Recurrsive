/**
 * Tests for the EnvironmentCollector.
 *
 * Tests cover:
 * - Dockerfile parsing (FROM, EXPOSE, multi-stage)
 * - Docker Compose parsing (services, depends_on, ports)
 * - Kubernetes manifest parsing
 * - File discovery patterns
 * - Empty project handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvironmentCollector } from '../../environment/collector.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recurrsive-env-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Dockerfile parsing
// ---------------------------------------------------------------------------

describe('Dockerfile parsing', () => {
  it('discovers and parses a Dockerfile', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'Dockerfile'),
      `FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
EXPOSE 3000
FROM node:20-alpine
COPY --from=builder /app/dist /app
CMD ["node", "/app/index.js"]
EXPOSE 3000 8080
`,
    );

    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    expect(result.entities.length).toBeGreaterThanOrEqual(1);

    const dockerEntity = result.entities.find((e) => e.properties['source'] === 'dockerfile');
    expect(dockerEntity).toBeDefined();
    expect(dockerEntity!.properties['base_image']).toBe('node:20-alpine');
    expect(dockerEntity!.properties['multi_stage']).toBe(true);
    expect((dockerEntity!.properties['stages'] as string[]).length).toBeGreaterThan(0);
    expect((dockerEntity!.properties['exposed_ports'] as number[])).toContain(3000);
    expect((dockerEntity!.properties['exposed_ports'] as number[])).toContain(8080);

    await collector.dispose();
  });

  it('skips FROM option flags like --platform when extracting the base image', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'Dockerfile'),
      `FROM --platform=linux/amd64 node:18 AS build
WORKDIR /app
FROM --platform=$BUILDPLATFORM node:18-slim
CMD ["node", "index.js"]
`,
    );

    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const dockerEntity = result.entities.find((e) => e.properties['source'] === 'dockerfile');
    expect(dockerEntity).toBeDefined();
    // The flag must never be reported as the base image.
    expect(dockerEntity!.properties['base_image']).toBe('node:18');
    expect(dockerEntity!.properties['stages']).toEqual(['build']);

    await collector.dispose();
  });

  it('handles no Dockerfile gracefully', async () => {
    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    expect(result.entities.length).toBe(0);
    expect(result.relationships.length).toBe(0);
    expect(result.metadata.items_processed).toBe(0);

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// Docker Compose parsing
// ---------------------------------------------------------------------------

describe('Docker Compose parsing', () => {
  it('parses compose services and dependencies', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'docker-compose.yml'),
      `version: "3.8"
services:
  web:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
      - redis
    environment:
      - NODE_ENV=production
  db:
    image: postgres:16
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
volumes:
  pgdata:
`,
    );

    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    // Should have: 1 compose config + 3 service entities = 4
    const composeConfig = result.entities.find((e) => e.properties['source'] === 'docker-compose' && e.type === 'config');
    expect(composeConfig).toBeDefined();
    expect(composeConfig!.properties['service_count']).toBe(3);

    const services = result.entities.filter((e) => e.type === 'infrastructure_resource');
    expect(services.length).toBe(3);

    const webService = services.find((e) => e.name.includes('web'));
    expect(webService).toBeDefined();

    const dbService = services.find((e) => e.name.includes('db'));
    expect(dbService).toBeDefined();
    expect(dbService!.properties['image']).toBe('postgres:16');

    // Should have contains relationships (compose → services)
    const containsRels = result.relationships.filter((r) => r.type === 'contains');
    expect(containsRels.length).toBe(3);

    // web depends on BOTH db and redis — one edge per declared target
    const dependsRels = result.relationships.filter((r) => r.type === 'depends_on');
    expect(dependsRels.length).toBe(2);
    for (const rel of dependsRels) {
      expect(rel.source_id).toBe(webService!.id);
    }
    const redisService = services.find((e) => e.name.includes('redis'));
    const targets = dependsRels.map((r) => r.target_id).sort();
    expect(targets).toEqual([dbService!.id, redisService!.id].sort());

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// Kubernetes manifest parsing
// ---------------------------------------------------------------------------

describe('Kubernetes manifest parsing', () => {
  it('parses K8s deployment manifests', async () => {
    const k8sDir = path.join(tmpDir, 'k8s');
    await fs.mkdir(k8sDir, { recursive: true });

    await fs.writeFile(
      path.join(k8sDir, 'deployment.yml'),
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: production
  labels:
    app: api-server
    team: platform
spec:
  replicas: 3
`,
    );

    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const deployment = result.entities.find((e) => e.properties['source'] === 'kubernetes');
    expect(deployment).toBeDefined();
    expect(deployment!.type).toBe('deployment');
    expect(deployment!.properties['kind']).toBe('Deployment');
    expect(deployment!.properties['namespace']).toBe('production');
    expect(deployment!.properties['replicas']).toBe(3);
    expect((deployment!.properties['labels'] as Record<string, string>)['app']).toBe('api-server');

    await collector.dispose();
  });

  it('does not merge metadata annotations into labels', async () => {
    const k8sDir = path.join(tmpDir, 'k8s');
    await fs.mkdir(k8sDir, { recursive: true });

    await fs.writeFile(
      path.join(k8sDir, 'deployment.yml'),
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  labels:
    app: api-server
  annotations:
    deployment.kubernetes.io/revision: "4"
    checksum/config: abc123
spec:
  replicas: 1
`,
    );

    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const deployment = result.entities.find((e) => e.properties['source'] === 'kubernetes');
    expect(deployment).toBeDefined();
    const labels = deployment!.properties['labels'] as Record<string, string>;
    expect(labels).toEqual({ app: 'api-server' });

    await collector.dispose();
  });

  it('applies exclusion patterns against repo-relative paths before reading', async () => {
    const k8sDir = path.join(tmpDir, 'k8s', 'secrets');
    await fs.mkdir(k8sDir, { recursive: true });

    await fs.writeFile(
      path.join(k8sDir, 'secret.yml'),
      `apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
`,
    );

    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({
      governance: {
        masked_fields: [],
        excluded_patterns: ['k8s/secrets/**'],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: {},
    });

    const result = await collector.collect();

    // The excluded manifest must never be collected — the glob is
    // matched against the repo-relative path, not the absolute one.
    expect(result.entities.length).toBe(0);

    await collector.dispose();
  });

  it('counts containers declared under spec.template.spec.containers', async () => {
    const k8sDir = path.join(tmpDir, 'k8s');
    await fs.mkdir(k8sDir, { recursive: true });

    await fs.writeFile(
      path.join(k8sDir, 'deployment.yml'),
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: production
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: web
          image: nginx:1.25
          ports:
            - containerPort: 80
        - name: sidecar
          image: envoyproxy/envoy:v1.30
`,
    );

    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const deployment = result.entities.find((e) => e.properties['source'] === 'kubernetes');
    expect(deployment).toBeDefined();
    expect(deployment!.properties['container_count']).toBe(2);

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates accessible path', async () => {
    const collector = new EnvironmentCollector(tmpDir);
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects inaccessible path', async () => {
    const collector = new EnvironmentCollector('/nonexistent/path/42');
    const result = await collector.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('Metadata', () => {
  it('has correct collector metadata', () => {
    const collector = new EnvironmentCollector(tmpDir);
    expect(collector.id).toBe('environment');
    expect(collector.name).toBe('Environment Collector');
    expect(collector.version).toBe('0.1.0');
  });

  it('returns timing metadata', async () => {
    const collector = new EnvironmentCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('environment');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.items_processed).toBe(0);

    await collector.dispose();
  });
});
