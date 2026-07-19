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
 * - `deployment` — deployment events
 * - `environment` — deployment target environments
 * - `user` — GitLab users (MR authors, reviewers, members)
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

/**
 * Subset of a GitLab pipeline LIST API response.
 * Note: the list endpoint does NOT include the triggering user — that
 * is only available from the single-pipeline detail endpoint.
 */
interface GitLabPipeline {
  id: number;
  ref: string;
  status: string;
}

/** Subset of a GitLab single-pipeline detail API response. */
interface GitLabPipelineDetail {
  id: number;
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
  /** Status exactly as reported by the GitLab API, or 'unknown'. */
  status: string;
  /**
   * Username that triggered the pipeline, from the single-pipeline
   * detail endpoint. Omitted when the detail could not be fetched or
   * reported no user — never guessed.
   */
  triggeredBy?: string;
  /** Jobs sorted by id ascending (GitLab creates jobs in stage order). */
  jobs: Array<{ name: string; stage: string }>;
}

interface CollectedEnvironment {
  name: string;
  /** Tier exactly as reported by the GitLab API, or 'unknown'. */
  tier: string;
  url: string;
}

interface CollectedDeployment {
  environment: string;
  sha: string;
  deployer: string;
  /** Status exactly as reported by the GitLab API, or 'unknown'. */
  status: string;
  /**
   * Id of the pipeline that produced the deployable. Omitted when the
   * API reported none — never fabricated as 0.
   */
  pipelineId?: number;
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

  /** Per-request timeout for GitLab API calls, in milliseconds. */
  private static readonly FETCH_TIMEOUT_MS = 10_000;

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
    let nextPageAvailable = false;

    // Add per_page param if not already present
    const separator = path.includes('?') ? '&' : '?';
    const basePath = path.includes('per_page') ? path : `${path}${separator}per_page=30`;

    try {
      while (results.length < maxItems) {
        nextPageAvailable = false;
        const pageParam = basePath.includes('per_page') ? `&page=${page}` : `?page=${page}`;
        const url = `${this.apiBase}/api/v4${basePath}${pageParam}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GitLabCollector.FETCH_TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch(url, {
            headers: {
              'PRIVATE-TOKEN': this.token,
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        // Check rate limit (GitLab uses RateLimit-Remaining)
        const remaining = response.headers.get('RateLimit-Remaining');
        const rateLimited = remaining !== null && parseInt(remaining, 10) <= 0;
        const resetTime = response.headers.get('RateLimit-Reset');

        if (!response.ok) {
          const msg = rateLimited
            ? `GitLab API rate limit exhausted (${response.status} for ${url}). Resets at ${resetTime}`
            : `GitLab API error: ${response.status} ${response.statusText} for ${url}`;
          logger.warn(msg);
          errors.push({ message: msg, details: { status: response.status } });
          break;
        }

        const data = (await response.json()) as T[];

        if (!Array.isArray(data) || data.length === 0) break;
        results.push(...data);

        // Rate limit exhausted: keep what this (successful) response
        // returned, but stop paginating further.
        if (rateLimited) {
          const msg = `GitLab API rate limit exhausted after ${url}; stopping pagination. Resets at ${resetTime}`;
          logger.warn(msg);
          errors.push({ message: msg });
          break;
        }

        // Check if there's a next page
        const nextPage = response.headers.get('X-Next-Page');
        if (!nextPage || nextPage === '') break;
        nextPageAvailable = true;
        page = parseInt(nextPage, 10);
      }
    } catch (err) {
      const msg = `GitLab API fetch failed for ${path}: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    // Record silent truncation honestly: either more pages existed at the
    // cap, or the final slice below drops already-fetched items.
    if (results.length > maxItems || (nextPageAvailable && results.length >= maxItems)) {
      const msg = `GitLab API results for ${path} truncated to ${maxItems} items; additional items exist but were not collected`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    return results.slice(0, maxItems);
  }

  /**
   * Make a single (non-paginated) GET request to the GitLab API.
   * Used for endpoints that return an object, not an array.
   */
  private async fetchSingle<T>(
    path: string,
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<T | null> {
    if (!this.token) {
      logger.warn('No GitLab token configured, skipping API call', { path });
      errors.push({ message: `No GitLab token configured, skipping: ${path}` });
      return null;
    }

    try {
      const url = `${this.apiBase}/api/v4${path}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GitLabCollector.FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'PRIVATE-TOKEN': this.token,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const remaining = response.headers.get('RateLimit-Remaining');
      const rateLimited = remaining !== null && parseInt(remaining, 10) <= 0;
      const resetTime = response.headers.get('RateLimit-Reset');

      if (!response.ok) {
        const msg = rateLimited
          ? `GitLab API rate limit exhausted (${response.status} for ${url}). Resets at ${resetTime}`
          : `GitLab API error: ${response.status} ${response.statusText} for ${url}`;
        logger.warn(msg);
        errors.push({ message: msg, details: { status: response.status } });
        return null;
      }

      const parsed = (await response.json()) as T;

      if (rateLimited) {
        errors.push({ message: `GitLab API rate limit exhausted after ${url}; subsequent calls may fail. Resets at ${resetTime}` });
      }

      return parsed;
    } catch (err) {
      errors.push({ message: `GitLab API fetch failed for ${path}: ${err instanceof Error ? err.message : String(err)}` });
      return null;
    }
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

    // Cap per-pipeline detail/job lookups; record honestly when
    // fetched pipelines are dropped by the cap.
    const PIPELINE_LIMIT = 10;
    if (rawPipelines.length > PIPELINE_LIMIT) {
      const msg = `Only the first ${PIPELINE_LIMIT} of ${rawPipelines.length} fetched pipelines were processed; the rest were not collected`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    for (const pipeline of rawPipelines.slice(0, PIPELINE_LIMIT)) {
      // The pipelines LIST response carries no user — fetch the
      // single-pipeline detail for the real triggering user.
      const detail = await this.fetchSingle<GitLabPipelineDetail>(
        `/projects/${this.projectId}/pipelines/${encodeURIComponent(String(pipeline.id))}`,
        errors,
      );
      const triggeredBy = detail?.user?.username;

      // Fetch jobs for this pipeline
      const rawJobs = await this.fetchPaginated<GitLabJob>(
        `/projects/${this.projectId}/pipelines/${encodeURIComponent(String(pipeline.id))}/jobs`,
        errors,
        50,
      );

      // GitLab does not expose individual steps within a job via the
      // API, so no step entities are synthesized. Jobs are sorted by id
      // ascending: GitLab creates jobs in declared stage order, so first
      // appearance of each stage reflects the pipeline's stage order.
      const jobs = [...rawJobs]
        .sort((a, b) => a.id - b.id)
        .map((job) => ({
          name: job.name,
          stage: job.stage,
        }));

      collectedPipelines.push({
        id: pipeline.id,
        ref: pipeline.ref,
        // Report the status exactly as GitLab returned it — never guessed.
        status: pipeline.status || 'unknown',
        // Only include the triggering user when the detail actually
        // reported one — never defaulted to 'unknown'.
        ...(triggeredBy ? { triggeredBy } : {}),
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
    return rawEnvs.map((env) => ({
      name: env.name,
      // Report the tier exactly as GitLab returned it — never guessed.
      tier: env.tier || 'unknown',
      url: env.external_url || '',
    }));
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
      const pipelineId = d.deployable?.pipeline?.id;
      return {
        environment: d.environment || 'unknown',
        sha: d.sha?.substring(0, 8) || 'unknown',
        deployer: d.user?.username || 'unknown',
        // Report the status exactly as GitLab returned it; 'unknown' when
        // absent — never defaulted to a success state.
        status: d.status || 'unknown',
        // Only include the pipeline id when the API reported one —
        // never fabricated as 0.
        ...(typeof pipelineId === 'number' ? { pipelineId } : {}),
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
   * Extract the full project path from the URL. GitLab projects may be
   * nested in subgroups (e.g. `org/subgroup/project`), so the whole
   * path is preserved — never truncated to the first two segments.
   */
  private projectName(): string {
    try {
      const parts = new URL(this.gitlabUrl).pathname.split('/').filter(Boolean);
      return parts.join('/').replace(/\.git$/, '') || 'unknown/project';
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
          // Only present when the pipeline detail reported a real user.
          ...(pipeline.triggeredBy !== undefined ? { triggered_by: pipeline.triggeredBy } : {}),
          job_count: pipeline.jobs.length,
          platform: 'gitlab-ci',
          gitlab_url: this.gitlabUrl,
        }, ['gitlab-ci', pipeline.status]),
      );

      // Note: GitLab's API does not expose steps within a job, so no
      // step entities are produced — they would be fabrications.
      for (const job of pipeline.jobs) {
        entities.push(
          this.makeEntity('job', `pipeline-${pipeline.id}.${job.name}`, {
            stage: job.stage,
            pipeline_id: pipeline.id,
            platform: 'gitlab-ci',
          }, ['gitlab-ci', job.stage]),
        );
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
          // Only present when the API reported a producing pipeline.
          ...(deploy.pipelineId !== undefined ? { pipeline_id: deploy.pipelineId } : {}),
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
   * - `deploys_to` — deployment deploys to environment
   * - `depends_on` — job depends on jobs in the preceding declared stage
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
    const pipelineEntities = entities.filter((e) => e.type === 'pipeline');
    const jobs = entities.filter((e) => e.type === 'job');
    const workflows = entities.filter((e) => e.type === 'workflow');
    const deployments = entities.filter((e) => e.type === 'deployment');
    const environments = entities.filter((e) => e.type === 'environment');

    // User → Pipeline (triggers) — only when the pipeline detail
    // reported a real triggering user.
    for (const pipeline of pipelineEntities) {
      const triggeredBy = pipeline.properties['triggered_by'];
      if (typeof triggeredBy !== 'string') continue;
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

    // Job → Job (depends_on) — only across declared stages: each job
    // depends on the jobs of the immediately preceding stage (GitLab's
    // stage semantics). Jobs within the same stage run in parallel, so
    // no dependency is created between them. Single-stage pipelines get
    // no depends_on edges at all.
    for (const pipeline of pipelines) {
      // Stage order = first appearance in the id-sorted job list.
      const stageOrder: string[] = [];
      for (const job of pipeline.jobs) {
        if (!stageOrder.includes(job.stage)) stageOrder.push(job.stage);
      }
      if (stageOrder.length < 2) continue;

      const jobEntityFor = (name: string): Entity | undefined =>
        jobs.find(
          (j) =>
            j.properties['pipeline_id'] === pipeline.id &&
            j.name === `pipeline-${pipeline.id}.${name}`,
        );

      for (let s = 1; s < stageOrder.length; s++) {
        const currentStageJobs = pipeline.jobs.filter((j) => j.stage === stageOrder[s]);
        const previousStageJobs = pipeline.jobs.filter((j) => j.stage === stageOrder[s - 1]);
        for (const current of currentStageJobs) {
          const currentEntity = jobEntityFor(current.name);
          if (!currentEntity) continue;
          for (const previous of previousStageJobs) {
            const previousEntity = jobEntityFor(previous.name);
            if (!previousEntity) continue;
            relationships.push(
              this.makeRel('depends_on', currentEntity.id, previousEntity.id, {
                derived_from: 'stage_order',
                source_stage: current.stage,
                target_stage: previous.stage,
              }),
            );
          }
        }
      }
    }

    return relationships;
  }
}
