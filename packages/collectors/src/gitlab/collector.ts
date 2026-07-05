/**
 * @module @recurrsive/collectors/gitlab/collector
 *
 * GitLab Collector — ingests merge requests, pipelines, jobs,
 * environments, deployments, and members from a GitLab project and
 * produces entities and relationships for the knowledge graph.
 *
 * Uses native `fetch` to call GitLab API v4. Reads authentication
 * token from `config.custom.gitlab_token` or `process.env.GITLAB_TOKEN`.
 * Falls back gracefully to empty results when no token or API is
 * unavailable.
 *
 * Produces entities:
 * - `workflow` — merge request workflows
 * - `pipeline` — CI/CD pipelines
 * - `job` — individual pipeline jobs
 * - `step` — steps within jobs
 * - `deployment` — deployment events
 * - `environment` — deployment target environments
 * - `user` — GitLab users (MR authors, reviewers, members)
 * - `team` — project groups
 *
 * @packageDocumentation
 */

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
  CollectorError,
} from '@recurrsive/core';
import { GovernanceFilter } from '../base/governance.js';

const logger = createLogger({ context: { module: 'gitlab-collector' } });

// ---------------------------------------------------------------------------
// Internal Types — shapes of GitLab API v4 responses (partial)
// ---------------------------------------------------------------------------

/** Subset of a GitLab merge request API response. */
interface GitLabMR {
  iid: number;
  title: string;
  author: { username: string } | null;
  reviewers: Array<{ username: string }>;
  state: string;
  labels: string[];
}

/** Subset of a GitLab pipeline API response. */
interface GitLabPipeline {
  id: number;
  ref: string;
  status: string;
  user: { username: string } | null;
}

/** Subset of a GitLab job API response. */
interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  pipeline: { id: number };
  runner: { description: string } | null;
}

/** Subset of a GitLab environment API response. */
interface GitLabEnvironment {
  id: number;
  name: string;
  tier: string | null;
  external_url: string | null;
}

/** Subset of a GitLab deployment API response. */
interface GitLabDeployment {
  id: number;
  environment: string;
  sha: string;
  user: { username: string } | null;
  status: string;
  deployable: { pipeline: { id: number } } | null;
}

/** Subset of a GitLab member API response. */
interface GitLabMember {
  username: string;
  name: string;
  access_level: number;
}

// ---------------------------------------------------------------------------
// Collected data containers
// ---------------------------------------------------------------------------

interface CollectedMR {
  iid: number;
  title: string;
  author: string;
  reviewers: string[];
  state: 'opened' | 'closed' | 'merged';
  labels: string[];
}

interface CollectedPipeline {
  id: number;
  ref: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  triggeredBy: string;
  jobs: Array<{ name: string; stage: string; steps: string[] }>;
}

interface CollectedEnvironment {
  name: string;
  tier: 'production' | 'staging' | 'development';
  url: string;
}

interface CollectedDeployment {
  environment: string;
  sha: string;
  deployer: string;
  status: 'success' | 'failed' | 'running';
  pipelineId: number;
}

// ---------------------------------------------------------------------------
// GitLabCollector
// ---------------------------------------------------------------------------

/**
 * Collects merge requests, pipelines, jobs, environments, and
 * deployment data from a GitLab project.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules, GitLab URL, and API token.
 * 2. {@link validate} — verify the GitLab URL is well-formed.
 * 3. {@link collect} — fetch real data from GitLab API and generate
 *    entities & relationships.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new GitLabCollector('https://gitlab.com/org/project');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { gitlab_token: 'glpat-...' },
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class GitLabCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'gitlab';
  /** @inheritdoc */
  readonly name = 'GitLab Collector';
  /** @inheritdoc */
  readonly description = 'Collects merge requests, pipelines, jobs, environments, and deployments from GitLab projects';
  /** @inheritdoc */
  readonly type: CollectorType = 'gitlab';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** GitLab project URL. */
  private gitlabUrl: string;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;
  /** GitLab API token. */
  private token: string | undefined;
  /** GitLab API base URL. */
  private apiBase = 'https://gitlab.com';
  /** URL-encoded project path (e.g. `org%2Fproject`). */
  private projectId = '';

  /**
   * @param gitlabUrl - GitLab project URL (e.g. `https://gitlab.com/org/project`).
   */
  constructor(gitlabUrl: string) {
    this.gitlabUrl = gitlabUrl;
  }

  // -----------------------------------------------------------------------
  // Collector Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the collector with configuration.
   *
   * @param config - Collector configuration including governance rules.
   */
  async initialize(config: CollectorConfig): Promise<void> {
    this.governanceFilter = new GovernanceFilter(config.governance);

    if (typeof config.custom['gitlabUrl'] === 'string') {
      this.gitlabUrl = config.custom['gitlabUrl'];
    }

    // Resolve token
    this.token =
      (typeof config.custom['gitlab_token'] === 'string' ? config.custom['gitlab_token'] : undefined) ||
      process.env['GITLAB_TOKEN'] ||
      undefined;

    // Resolve GitLab base URL
    if (typeof config.custom['gitlab_url'] === 'string') {
      this.apiBase = config.custom['gitlab_url'];
    } else {
      // Auto-detect from the project URL
      try {
        const parsed = new URL(this.gitlabUrl);
        this.apiBase = `${parsed.protocol}//${parsed.host}`;
      } catch {
        this.apiBase = 'https://gitlab.com';
      }
    }

    // Resolve project ID (URL-encoded path)
    if (typeof config.custom['gitlab_project_id'] === 'string') {
      this.projectId = config.custom['gitlab_project_id'];
    } else {
      this.projectId = this.parseProjectPath(this.gitlabUrl);
    }

    this.initialized = true;
    logger.info('GitLabCollector initialized', {
      gitlabUrl: this.gitlabUrl,
      apiBase: this.apiBase,
      projectId: this.projectId,
      hasToken: !!this.token,
    });
  }

  /**
   * Validate that the configured GitLab URL is well-formed.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.gitlabUrl) {
      errors.push('GitLab URL is required');
    } else {
      try {
        const url = new URL(this.gitlabUrl);
        if (!url.hostname.includes('gitlab')) {
          errors.push(`'${this.gitlabUrl}' does not appear to be a GitLab URL`);
        }
      } catch {
        errors.push(`'${this.gitlabUrl}' is not a valid URL`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the full collection run.
   *
   * @returns Entities, relationships, and run metadata.
   * @throws {CollectorError} If the collector has not been initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'GitLabCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // Fetch data from GitLab API (or empty arrays on failure)
    const members = await this.fetchMembers(errors);
    const mrs = await this.fetchMergeRequests(errors);
    const pipelines = await this.fetchPipelines(errors);
    const environments = await this.fetchEnvironments(errors);
    const deployments = await this.fetchDeployments(errors);

    const itemsProcessed = members.length + mrs.length + pipelines.length + environments.length + deployments.length;

    // Build entities and relationships from fetched data
    const entities = this.buildEntities(members, pipelines, mrs, environments, deployments);
    const relationships = this.buildRelationships(entities, mrs, pipelines);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    logger.info('GitLabCollector collection complete', {
      entities: maskedEntities.length,
      relationships: relationships.length,
      durationMs,
    });

    return {
      entities: maskedEntities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: itemsProcessed,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('GitLabCollector disposed', { gitlabUrl: this.gitlabUrl });
  }

  // -----------------------------------------------------------------------
  // Internal: GitLab API Fetching
  // -----------------------------------------------------------------------

  /**
   * Parse URL-encoded project path from a GitLab URL.
   */
  private parseProjectPath(url: string): string {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      // GitLab projects can be nested: org/subgroup/project
      const projectPath = parts.join('/');
      return encodeURIComponent(projectPath);
    } catch {
      return encodeURIComponent('unknown/project');
    }
  }

  /**
   * Make a paginated GET request to the GitLab API.
   * GitLab uses `X-Page`, `X-Next-Page` headers for pagination.
   * Returns up to `maxItems` results across pages.
   */
  private async fetchPaginated<T>(
    path: string,
    errors: Array<{ message: string; details?: unknown }>,
    maxItems = 100,
  ): Promise<T[]> {
    if (!this.token) {
      logger.warn('No GitLab token configured, skipping API call', { path });
      errors.push({ message: `No GitLab token configured, skipping: ${path}` });
      return [];
    }

    const results: T[] = [];
    let page = 1;

    // Add per_page param if not already present
    const separator = path.includes('?') ? '&' : '?';
    const basePath = path.includes('per_page') ? path : `${path}${separator}per_page=30`;

    try {
      while (results.length < maxItems) {
        const pageParam = basePath.includes('per_page') ? `&page=${page}` : `?page=${page}`;
        const url = `${this.apiBase}/api/v4${basePath}${pageParam}`;

        const response = await fetch(url, {
          headers: {
            'PRIVATE-TOKEN': this.token,
            'Accept': 'application/json',
          },
        });

        // Check rate limit (GitLab uses RateLimit-Remaining)
        const remaining = response.headers.get('RateLimit-Remaining');
        if (remaining !== null && parseInt(remaining, 10) <= 0) {
          const resetTime = response.headers.get('RateLimit-Reset');
          const msg = `GitLab API rate limit exhausted. Resets at ${resetTime}`;
          logger.warn(msg);
          errors.push({ message: msg });
          break;
        }

        if (!response.ok) {
          const msg = `GitLab API error: ${response.status} ${response.statusText} for ${url}`;
          logger.warn(msg);
          errors.push({ message: msg, details: { status: response.status } });
          break;
        }

        const data = (await response.json()) as T[];

        if (!Array.isArray(data) || data.length === 0) break;
        results.push(...data);

        // Check if there's a next page
        const nextPage = response.headers.get('X-Next-Page');
        if (!nextPage || nextPage === '') break;
        page = parseInt(nextPage, 10);
      }
    } catch (err) {
      const msg = `GitLab API fetch failed for ${path}: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    return results.slice(0, maxItems);
  }

  /**
   * Fetch project members from the GitLab API.
   */
  private async fetchMembers(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<string[]> {
    const members = await this.fetchPaginated<GitLabMember>(
      `/projects/${this.projectId}/members`,
      errors,
      100,
    );
    return members.map((m) => m.username);
  }

  /**
   * Fetch merge requests from the GitLab API.
   */
  private async fetchMergeRequests(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedMR[]> {
    const rawMRs = await this.fetchPaginated<GitLabMR>(
      `/projects/${this.projectId}/merge_requests?state=all&per_page=30`,
      errors,
      100,
    );
    return rawMRs.map((mr) => ({
      iid: mr.iid,
      title: mr.title,
      author: mr.author?.username || 'unknown',
      reviewers: (mr.reviewers || []).map((r) => r.username),
      state: (mr.state === 'opened' ? 'opened' : mr.state === 'merged' ? 'merged' : 'closed') as 'opened' | 'closed' | 'merged',
      labels: mr.labels || [],
    }));
  }

  /**
   * Fetch pipelines and their jobs from the GitLab API.
   */
  private async fetchPipelines(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedPipeline[]> {
    const rawPipelines = await this.fetchPaginated<GitLabPipeline>(
      `/projects/${this.projectId}/pipelines`,
      errors,
      30,
    );

    const collectedPipelines: CollectedPipeline[] = [];

    for (const pipeline of rawPipelines.slice(0, 10)) {
      // Fetch jobs for this pipeline
      const rawJobs = await this.fetchPaginated<GitLabJob>(
        `/projects/${this.projectId}/pipelines/${pipeline.id}/jobs`,
        errors,
        50,
      );

      const jobs = rawJobs.map((job) => ({
        name: job.name,
        stage: job.stage,
        // GitLab doesn't expose individual steps within a job via API,
        // so we create a single step representing the job script
        steps: [`Run ${job.name}`],
      }));

      const status = (['success', 'failed', 'running', 'pending'].includes(pipeline.status)
        ? pipeline.status
        : 'pending') as CollectedPipeline['status'];

      collectedPipelines.push({
        id: pipeline.id,
        ref: pipeline.ref,
        status,
        triggeredBy: pipeline.user?.username || 'unknown',
        jobs,
      });
    }

    return collectedPipelines;
  }

  /**
   * Fetch environments from the GitLab API.
   */
  private async fetchEnvironments(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedEnvironment[]> {
    const rawEnvs = await this.fetchPaginated<GitLabEnvironment>(
      `/projects/${this.projectId}/environments`,
      errors,
      100,
    );
    return rawEnvs.map((env) => {
      const tier = (['production', 'staging', 'development'].includes(env.tier || '')
        ? env.tier
        : 'development') as CollectedEnvironment['tier'];
      return {
        name: env.name,
        tier,
        url: env.external_url || '',
      };
    });
  }

  /**
   * Fetch deployments from the GitLab API.
   */
  private async fetchDeployments(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedDeployment[]> {
    const rawDeployments = await this.fetchPaginated<GitLabDeployment>(
      `/projects/${this.projectId}/deployments`,
      errors,
      100,
    );
    return rawDeployments.map((d) => {
      const status = (['success', 'failed', 'running'].includes(d.status)
        ? d.status
        : 'success') as CollectedDeployment['status'];
      return {
        environment: d.environment || 'unknown',
        sha: d.sha?.substring(0, 8) || 'unknown',
        deployer: d.user?.username || 'unknown',
        status,
        pipelineId: d.deployable?.pipeline?.id || 0,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Helpers
  // -----------------------------------------------------------------------

  /**
   * Create a single entity with common defaults.
   */
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
      qualified_name: qualifiedName(this.projectName(), name),
      source: this.id,
      properties: props,
      tags: ['gitlab', ...tags],
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    };
  }

  /**
   * Create a single relationship with common defaults.
   */
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
      confidence: 1.0,
      source: this.id,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Extract the project name from the URL.
   */
  private projectName(): string {
    try {
      const parts = new URL(this.gitlabUrl).pathname.split('/').filter(Boolean);
      return parts.slice(0, 2).join('/') || 'unknown/project';
    } catch {
      return 'unknown/project';
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from GitLab data.
   *
   * Creates:
   * - `user` entities for each member
   * - `workflow` entities for each merge request workflow
   * - `pipeline` entities for each CI/CD pipeline
   * - `job` entities for each job within pipelines
   * - `step` entities for each step within jobs
   * - `environment` entities for each deployment environment
   * - `deployment` entities for each deployment event
   *
   * @returns Array of entities.
   */
  private buildEntities(
    users: string[],
    pipelines: CollectedPipeline[],
    mrs: CollectedMR[],
    environments: CollectedEnvironment[],
    deployments: CollectedDeployment[],
  ): Entity[] {
    const entities: Entity[] = [];

    // --- User entities ---
    for (const username of users) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          platform: 'gitlab',
          gitlab_url: this.gitlabUrl,
        }, ['member']),
      );
    }

    // --- Workflow entities (merge requests) ---
    for (const mr of mrs) {
      entities.push(
        this.makeEntity('workflow', `MR!${mr.iid}: ${mr.title}`, {
          iid: mr.iid,
          author: mr.author,
          reviewers: mr.reviewers,
          state: mr.state,
          labels: mr.labels,
          platform: 'gitlab',
          gitlab_url: this.gitlabUrl,
        }, ['merge-request', mr.state]),
      );
    }

    // --- Pipeline entities (with jobs and steps) ---
    for (const pipeline of pipelines) {
      entities.push(
        this.makeEntity('pipeline', `pipeline-${pipeline.id}`, {
          pipeline_id: pipeline.id,
          ref: pipeline.ref,
          status: pipeline.status,
          triggered_by: pipeline.triggeredBy,
          job_count: pipeline.jobs.length,
          platform: 'gitlab-ci',
          gitlab_url: this.gitlabUrl,
        }, ['gitlab-ci', pipeline.status]),
      );

      for (const job of pipeline.jobs) {
        entities.push(
          this.makeEntity('job', `pipeline-${pipeline.id}.${job.name}`, {
            stage: job.stage,
            step_count: job.steps.length,
            pipeline_id: pipeline.id,
            platform: 'gitlab-ci',
          }, ['gitlab-ci', job.stage]),
        );

        for (const stepName of job.steps) {
          entities.push(
            this.makeEntity('step', `pipeline-${pipeline.id}.${job.name}.${stepName}`, {
              job_name: job.name,
              pipeline_id: pipeline.id,
              platform: 'gitlab-ci',
            }, ['gitlab-ci']),
          );
        }
      }
    }

    // --- Environment entities ---
    for (const env of environments) {
      entities.push(
        this.makeEntity('environment', env.name, {
          tier: env.tier,
          url: env.url,
          platform: 'gitlab',
        }, [env.tier]),
      );
    }

    // --- Deployment entities ---
    for (const deploy of deployments) {
      entities.push(
        this.makeEntity('deployment', `deploy-${deploy.environment}-${deploy.sha}`, {
          environment: deploy.environment,
          sha: deploy.sha,
          deployer: deploy.deployer,
          status: deploy.status,
          pipeline_id: deploy.pipelineId,
          platform: 'gitlab',
        }, [deploy.environment]),
      );
    }

    return entities;
  }

  // -----------------------------------------------------------------------
  // Internal: Relationship Building
  // -----------------------------------------------------------------------

  /**
   * Build relationships between entities.
   *
   * Creates:
   * - `triggers` — user triggers pipeline
   * - `reviews` — user reviews merge request
   * - `owns` — team owns project (workflow)
   * - `deploys_to` — deployment deploys to environment
   * - `depends_on` — job depends on previous job in pipeline
   * - `contains` — pipeline contains jobs
   *
   * @param entities - All entities built from this collection.
   * @param mrs - Collected merge requests for review relationships.
   * @param pipelines - Collected pipelines for dependency relationships.
   * @returns Array of relationships.
   */
  private buildRelationships(
    entities: Entity[],
    mrs: CollectedMR[],
    pipelines: CollectedPipeline[],
  ): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const teams = entities.filter((e) => e.type === 'team');
    const pipelineEntities = entities.filter((e) => e.type === 'pipeline');
    const jobs = entities.filter((e) => e.type === 'job');
    const workflows = entities.filter((e) => e.type === 'workflow');
    const deployments = entities.filter((e) => e.type === 'deployment');
    const environments = entities.filter((e) => e.type === 'environment');

    // User → Pipeline (triggers)
    for (const pipeline of pipelineEntities) {
      const triggeredBy = pipeline.properties['triggered_by'] as string;
      const userEntity = users.find((u) => u.name === triggeredBy);
      if (userEntity) {
        relationships.push(this.makeRel('triggers', userEntity.id, pipeline.id, {
          pipeline_id: pipeline.properties['pipeline_id'],
        }));
      }
    }

    // User reviews MR (reviewer → workflow)
    for (const mr of mrs) {
      const mrEntity = workflows.find((w) =>
        w.properties['iid'] === mr.iid,
      );
      if (!mrEntity) continue;
      for (const reviewer of mr.reviewers) {
        const reviewerEntity = users.find((u) => u.name === reviewer);
        if (reviewerEntity) {
          relationships.push(this.makeRel('reviews', reviewerEntity.id, mrEntity.id, {
            mr_iid: mr.iid,
            mr_title: mr.title,
          }));
        }
      }
    }

    // Team → Workflow (owns)
    if (teams.length > 0 && workflows.length > 0) {
      for (let i = 0; i < workflows.length && i < teams.length; i++) {
        relationships.push(this.makeRel('owns', teams[i]!.id, workflows[i]!.id));
      }
    }

    // Deployment → Environment (deploys_to)
    for (const deploy of deployments) {
      const envName = deploy.properties['environment'] as string;
      const envEntity = environments.find((e) => e.name === envName);
      if (envEntity) {
        relationships.push(this.makeRel('deploys_to', deploy.id, envEntity.id, {
          environment: envName,
          sha: deploy.properties['sha'],
        }));
      }
    }

    // Pipeline → Job (contains)
    for (const pipeline of pipelines) {
      const pipelineEntity = pipelineEntities.find(
        (p) => p.properties['pipeline_id'] === pipeline.id,
      );
      if (!pipelineEntity) continue;

      const pipelineJobs = jobs.filter(
        (j) => j.properties['pipeline_id'] === pipeline.id,
      );
      for (const job of pipelineJobs) {
        relationships.push(this.makeRel('contains', pipelineEntity.id, job.id, {
          stage: job.properties['stage'],
        }));
      }
    }

    // Job → Job (depends_on) — sequential jobs within same pipeline
    for (const pipeline of pipelines) {
      const pipelineJobs = jobs.filter(
        (j) => j.properties['pipeline_id'] === pipeline.id,
      );
      for (let i = 1; i < pipelineJobs.length; i++) {
        relationships.push(
          this.makeRel('depends_on', pipelineJobs[i]!.id, pipelineJobs[i - 1]!.id),
        );
      }
    }

    return relationships;
  }
}
