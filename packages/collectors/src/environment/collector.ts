/**
 * @module @recurrsive/collectors/environment/collector
 *
 * Environment Collector — discovers and parses Dockerfiles,
 * Docker Compose files, and Kubernetes manifests to build
 * infrastructure topology entities and relationships.
 *
 * Produces entities:
 * - `infrastructure_resource` — each Docker/K8s service definition
 * - `config` — config files, compose files, K8s configmaps
 * - `deployment` — K8s deployment resources
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  CollectorType,
  Entity,
  Relationship,
} from '@recurrsive/core';
import {
  generateId,
  qualifiedName,
  nowISO,
  createLogger,
} from '@recurrsive/core';
import { GovernanceFilter } from '../base/governance.js';

const logger = createLogger({ context: { module: 'environment-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface DockerfileInfo {
  path: string;
  baseImage: string;
  stages: string[];
  exposedPorts: number[];
  commands: string[];
}

interface ComposeService {
  name: string;
  image?: string;
  build?: string;
  ports: string[];
  depends_on: string[];
  volumes: string[];
  environment: string[];
  networks: string[];
}

interface K8sResource {
  kind: string;
  name: string;
  namespace: string;
  path: string;
  labels: Record<string, string>;
  replicas?: number;
  containers: Array<{
    name: string;
    image: string;
    ports: number[];
  }>;
}

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseDockerfile(content: string, filePath: string): DockerfileInfo {
  const lines = content.split('\n');
  const stages: string[] = [];
  const exposedPorts: number[] = [];
  const commands: string[] = [];
  let baseImage = 'unknown';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    if (/^FROM\s/i.test(trimmed)) {
      // Skip option flags like `--platform=linux/amd64` — the image
      // reference is the first non-flag token after FROM.
      const tokens = trimmed.split(/\s+/).slice(1).filter((t) => !t.startsWith('--'));
      const image = tokens[0];
      if (image) {
        if (baseImage === 'unknown') baseImage = image;
        const asIndex = tokens.findIndex((t) => t.toUpperCase() === 'AS');
        const stageName = asIndex !== -1 ? tokens[asIndex + 1] : undefined;
        if (stageName) stages.push(stageName);
      }
    }

    const exposeMatch = trimmed.match(/^EXPOSE\s+(.+)/i);
    if (exposeMatch) {
      const ports = exposeMatch[1]!.split(/\s+/).map((p) => parseInt(p, 10)).filter((p) => !isNaN(p));
      exposedPorts.push(...ports);
    }

    const cmdMatch = trimmed.match(/^(RUN|CMD|ENTRYPOINT|COPY|ADD|ENV|WORKDIR|VOLUME|HEALTHCHECK)\s/i);
    if (cmdMatch) {
      commands.push(cmdMatch[1]!.toUpperCase());
    }
  }

  return { path: filePath, baseImage, stages, exposedPorts, commands };
}

function parseComposeFile(content: string): ComposeService[] {
  const services: ComposeService[] = [];

  // Simple YAML parser for compose services — handles common patterns
  // without requiring a full YAML library
  const lines = content.split('\n');
  let inServices = false;
  let currentService: ComposeService | null = null;
  let currentKey = '';

  for (const line of lines) {
    const stripped = line.replace(/\r$/, '');
    const lineIndent = stripped.length - stripped.trimStart().length;
    const trimmed = stripped.trim();

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // Top-level services key
    if (lineIndent === 0 && trimmed === 'services:') {
      inServices = true;
      continue;
    }

    if (lineIndent === 0 && trimmed !== 'services:') {
      inServices = false;
      if (currentService) {
        services.push(currentService);
        currentService = null;
      }
      continue;
    }

    if (!inServices) continue;

    // Service name (indent 2)
    if (lineIndent === 2 && trimmed.endsWith(':') && !trimmed.startsWith('-')) {
      if (currentService) services.push(currentService);
      currentService = {
        name: trimmed.slice(0, -1),
        ports: [],
        depends_on: [],
        volumes: [],
        environment: [],
        networks: [],
      };

      continue;
    }

    if (!currentService) continue;

    // Service properties (indent 4)
    if (lineIndent === 4 && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      currentKey = key!.trim();

      if (currentKey === 'image' && value) {
        currentService.image = value;
      } else if (currentKey === 'build' && value) {
        currentService.build = value;
      }
    }

    // List items (indent 6 with dash)
    if (lineIndent >= 6 && trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
      if (currentKey === 'ports') currentService.ports.push(value);
      else if (currentKey === 'depends_on') currentService.depends_on.push(value);
      else if (currentKey === 'volumes') currentService.volumes.push(value);
      else if (currentKey === 'environment') currentService.environment.push(value);
      else if (currentKey === 'networks') currentService.networks.push(value);
    }
  }

  if (currentService) services.push(currentService);
  return services;
}

function parseK8sManifest(content: string, filePath: string): K8sResource | null {
  // Simple YAML key-value extraction for K8s resources
  const lines = content.split('\n');
  let kind = '';
  let name = '';
  let namespace = 'default';
  const labels: Record<string, string> = {};
  let replicas: number | undefined;
  const containers: Array<{ name: string; image: string; ports: number[] }> = [];

  let inMetadata = false;
  let inLabels = false;
  let inSpec = false;
  let currentContainer: { name: string; image: string; ports: number[] } | null = null;
  // Container list tracking: containers live under spec.containers (Pod)
  // or spec.template.spec.containers (Deployment/StatefulSet/DaemonSet).
  let inContainers = false;
  let containersIndent = -1;
  let containerItemIndent = -1;

  const flushContainer = (): void => {
    if (currentContainer) {
      containers.push(currentContainer);
      currentContainer = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '' || trimmed === '---') continue;

    const lineIndent = line.length - line.trimStart().length;

    // Track the containers block (any nesting depth under spec)
    if (inContainers) {
      if (lineIndent <= containersIndent) {
        // Block ended — fall through to the regular key handling below.
        flushContainer();
        inContainers = false;
        containerItemIndent = -1;
      } else if (trimmed.startsWith('- ') || trimmed === '-') {
        const rest = trimmed.replace(/^-\s*/, '');
        if (rest.startsWith('containerPort:')) {
          // Port list item inside the current container.
          const port = parseInt(rest.split(':')[1]!.trim(), 10);
          if (currentContainer && !isNaN(port)) currentContainer.ports.push(port);
        } else if (containerItemIndent === -1 || lineIndent === containerItemIndent) {
          // New container list item.
          containerItemIndent = lineIndent;
          flushContainer();
          currentContainer = { name: '', image: '', ports: [] };
          if (rest.startsWith('name:')) currentContainer.name = rest.split(':').slice(1).join(':').trim();
          else if (rest.startsWith('image:')) currentContainer.image = rest.split(':').slice(1).join(':').trim();
        }
        continue;
      } else if (currentContainer) {
        if (trimmed.startsWith('name:') && !currentContainer.name) {
          currentContainer.name = trimmed.split(':').slice(1).join(':').trim();
        } else if (trimmed.startsWith('image:')) {
          currentContainer.image = trimmed.split(':').slice(1).join(':').trim();
        }
        continue;
      } else {
        continue;
      }
    }

    if (inSpec && /^containers:\s*$/.test(trimmed)) {
      inContainers = true;
      containersIndent = lineIndent;
      containerItemIndent = -1;
      continue;
    }

    // Top level
    if (lineIndent === 0) {
      inMetadata = false;
      inLabels = false;
      inSpec = false;
      flushContainer();

      if (trimmed.startsWith('kind:')) kind = trimmed.split(':')[1]!.trim();
      if (trimmed === 'metadata:') inMetadata = true;
      if (trimmed === 'spec:') inSpec = true;
    }

    if (inMetadata && lineIndent === 2) {
      if (trimmed.startsWith('name:')) name = trimmed.split(':')[1]!.trim();
      if (trimmed.startsWith('namespace:')) namespace = trimmed.split(':')[1]!.trim();
      // Any indent-2 metadata key other than `labels:` (annotations,
      // name, …) ends the labels block — otherwise annotation entries
      // would be misreported as labels.
      inLabels = trimmed === 'labels:';
    }

    if (inLabels && lineIndent === 4) {
      const [key, ...vals] = trimmed.split(':');
      if (key) labels[key.trim()] = vals.join(':').trim();
    }

    if (inSpec && lineIndent === 2) {
      if (trimmed.startsWith('replicas:')) {
        replicas = parseInt(trimmed.split(':')[1]!.trim(), 10);
      }
    }
  }

  flushContainer();

  if (!kind || !name) return null;

  return { kind, name, namespace, path: filePath, labels, replicas, containers };
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export class EnvironmentCollector implements Collector {
  readonly id = 'environment';
  readonly name = 'Environment Collector';
  readonly description = 'Collects Docker, Compose, and Kubernetes infrastructure topology.';
  readonly type: CollectorType = 'code';
  readonly version = '0.1.0';

  private rootPath: string;
  private governance: GovernanceFilter | null = null;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async initialize(config: CollectorConfig): Promise<void> {
    if (config.governance) {
      this.governance = new GovernanceFilter(config.governance);
    }
    logger.info('Environment collector initialized', { rootPath: this.rootPath });
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await fs.access(this.rootPath);
      return { valid: true, errors: [] };
    } catch {
      return { valid: false, errors: [`Path not accessible: ${this.rootPath}`] };
    }
  }

  // ── Entity / Relationship helpers ────────────────────────────────

  private makeEntity(
    type: Entity['type'],
    name: string,
    props: Record<string, unknown>,
    tags: string[] = [],
  ): Entity {
    const now = nowISO();
    return {
      id: generateId(),
      type,
      name,
      qualified_name: qualifiedName(name),
      source: this.id,
      properties: props,
      tags: ['infrastructure', ...tags],
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    };
  }

  private makeRel(
    type: Relationship['type'],
    sourceId: string,
    targetId: string,
    props: Record<string, unknown> = {},
  ): Relationship {
    const now = nowISO();
    return {
      id: generateId(),
      type,
      source_id: sourceId,
      target_id: targetId,
      properties: props,
      confidence: 1,
      source: this.id,
      created_at: now,
      updated_at: now,
    };
  }

  /** True when the error is an expected "file/directory absent" error. */
  private static isAbsenceError(err: unknown): boolean {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
  }

  async collect(): Promise<CollectorResult> {
    const startTime = Date.now();
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];
    const errors: Array<{ message: string; details?: unknown }> = [];

    // ── Discover and parse Dockerfiles ──────────────────────────────
    const dockerfiles = await this.findDockerfiles(errors);
    for (const df of dockerfiles) {
      const parsed = parseDockerfile(df.content, df.path);

      entities.push(this.makeEntity(
        'infrastructure_resource',
        path.relative(this.rootPath, df.path),
        {
          source: 'dockerfile',
          base_image: parsed.baseImage,
          stages: parsed.stages,
          exposed_ports: parsed.exposedPorts,
          commands: parsed.commands,
          multi_stage: parsed.stages.length > 0,
          absolute_path: df.path,
        },
        ['docker', parsed.baseImage.split(':')[0]!],
      ));
    }

    // ── Discover and parse Docker Compose files ────────────────────
    const composeFiles = await this.findComposeFiles(errors);
    for (const cf of composeFiles) {
      const services = parseComposeFile(cf.content);

      const composeEntity = this.makeEntity(
        'config',
        path.relative(this.rootPath, cf.path),
        {
          source: 'docker-compose',
          service_count: services.length,
          absolute_path: cf.path,
        },
        ['docker-compose'],
      );
      entities.push(composeEntity);

      // Create entities for each service
      for (const svc of services) {
        const svcEntity = this.makeEntity(
          'infrastructure_resource',
          `compose.${svc.name}`,
          {
            source: 'docker-compose',
            image: svc.image ?? null,
            build_context: svc.build ?? null,
            ports: svc.ports,
            volumes: svc.volumes,
            environment_vars: svc.environment.length,
            networks: svc.networks,
          },
          ['docker-compose', svc.name],
        );
        entities.push(svcEntity);

        // Compose file → service relationship
        relationships.push(this.makeRel('contains', composeEntity.id, svcEntity.id));

        // depends_on → depends_on relationships (resolved later)
        for (const dep of svc.depends_on) {
          const depEntity = entities.find(
            (e) => e.name === dep || e.qualified_name === qualifiedName(`compose.${dep}`),
          );
          if (depEntity) {
            relationships.push(this.makeRel('depends_on', svcEntity.id, depEntity.id));
          }
        }
      }

      // Second pass: resolve depends_on for services defined later.
      // Deduplicate against the specific (source, target) pair — a
      // service depending on several others must get an edge for each.
      for (const svc of services) {
        const svcEntity = entities.find(
          (e) => e.qualified_name === qualifiedName(`compose.${svc.name}`) && e.type === 'infrastructure_resource',
        );
        if (!svcEntity) continue;
        for (const dep of svc.depends_on) {
          const depEntity = entities.find(
            (e) => e.qualified_name === qualifiedName(`compose.${dep}`) && e.type === 'infrastructure_resource',
          );
          if (!depEntity) continue;
          const existing = relationships.find(
            (r) =>
              r.type === 'depends_on' &&
              r.source_id === svcEntity.id &&
              r.target_id === depEntity.id,
          );
          if (existing) continue;
          relationships.push(this.makeRel('depends_on', svcEntity.id, depEntity.id));
        }
      }
    }

    // ── Discover and parse Kubernetes manifests ────────────────────
    const k8sFiles = await this.findK8sManifests(errors);
    for (const kf of k8sFiles) {
      // Split multi-document YAML
      const docs = kf.content.split(/^---$/m);
      for (const doc of docs) {
        if (doc.trim() === '') continue;
        const resource = parseK8sManifest(doc, kf.path);
        if (!resource) continue;

        const entityType = ['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind)
          ? 'deployment' as const
          : 'config' as const;

        entities.push(this.makeEntity(
          entityType,
          `k8s.${resource.namespace}.${resource.kind}.${resource.name}`,
          {
            source: 'kubernetes',
            kind: resource.kind,
            namespace: resource.namespace,
            labels: resource.labels,
            replicas: resource.replicas ?? null,
            container_count: resource.containers.length,
            absolute_path: kf.path,
          },
          ['kubernetes', resource.kind.toLowerCase()],
        ));
      }
    }

    const durationMs = Date.now() - startTime;

    // Apply governance masking to all entities.
    const maskedEntities = this.governance
      ? entities.map((e) => this.governance!.maskEntity(e))
      : entities;

    logger.info('Environment collection complete', {
      entities: maskedEntities.length,
      relationships: relationships.length,
      dockerfiles: dockerfiles.length,
      composeFiles: composeFiles.length,
      k8sFiles: k8sFiles.length,
      errors: errors.length,
      durationMs,
    });

    return {
      entities: maskedEntities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: dockerfiles.length + composeFiles.length + k8sFiles.length,
        errors,
      },
    };
  }

  async dispose(): Promise<void> {
    this.governance = null;
  }

  // ── File discovery helpers ─────────────────────────────────────

  /**
   * Read a discovered file, applying governance exclusion (against the
   * repo-relative path, so patterns like `secrets/**` match) BEFORE the
   * file is ever read. Real read failures are recorded in `errors`;
   * absence is silent (discovery probes many optional paths).
   *
   * @returns The file content, or `null` when excluded/absent/unreadable.
   */
  private async readDiscoveredFile(
    filePath: string,
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<string | null> {
    const relativePath = path.relative(this.rootPath, filePath);

    // Exclusion must be checked before reading — excluded content should
    // never enter this process.
    if (this.governance?.isExcluded(relativePath)) return null;

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      if (!EnvironmentCollector.isAbsenceError(err)) {
        const msg = `Failed to read '${relativePath}': ${err instanceof Error ? err.message : String(err)}`;
        logger.warn(msg);
        errors.push({ message: msg });
      }
      return null;
    }
  }

  private async findDockerfiles(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    const patterns = ['Dockerfile', 'Dockerfile.dev', 'Dockerfile.prod', 'Dockerfile.staging'];

    // Check root and docker/ subdirectory
    for (const dir of [this.rootPath, path.join(this.rootPath, 'docker')]) {
      for (const name of patterns) {
        const filePath = path.join(dir, name);
        const content = await this.readDiscoveredFile(filePath, errors);
        if (content !== null) {
          results.push({ path: filePath, content });
        }
      }
    }

    return results;
  }

  private async findComposeFiles(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    const names = [
      'docker-compose.yml', 'docker-compose.yaml',
      'docker-compose.dev.yml', 'docker-compose.dev.yaml',
      'docker-compose.prod.yml', 'docker-compose.prod.yaml',
      'docker-compose.override.yml', 'docker-compose.override.yaml',
      'compose.yml', 'compose.yaml',
    ];

    for (const name of names) {
      const filePath = path.join(this.rootPath, name);
      const content = await this.readDiscoveredFile(filePath, errors);
      if (content !== null) {
        results.push({ path: filePath, content });
      }
    }

    return results;
  }

  private async findK8sManifests(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];

    const k8sDirs = ['k8s', 'kubernetes', 'deploy', 'deployments', 'manifests', 'helm'];
    for (const dir of k8sDirs) {
      const fullDir = path.join(this.rootPath, dir);
      try {
        const stat = await fs.stat(fullDir);
        if (!stat.isDirectory()) continue;
        await this.walkK8sDir(fullDir, results, errors);
      } catch (err) {
        // Absent directories are expected; real failures are recorded.
        if (!EnvironmentCollector.isAbsenceError(err)) {
          const msg = `Failed to scan '${dir}': ${err instanceof Error ? err.message : String(err)}`;
          logger.warn(msg);
          errors.push({ message: msg });
        }
      }
    }

    return results;
  }

  private async walkK8sDir(
    dir: string,
    results: Array<{ path: string; content: string }>,
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      const msg = `Failed to list '${path.relative(this.rootPath, dir)}': ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(msg);
      errors.push({ message: msg });
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkK8sDir(fullPath, results, errors);
      } else if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) {
        const content = await this.readDiscoveredFile(fullPath, errors);
        if (content !== null) {
          results.push({ path: fullPath, content });
        }
      }
    }
  }
}
