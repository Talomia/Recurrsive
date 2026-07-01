/**
 * @module @recurrsive/collectors/gitlab/collector
 *
 * GitLab Collector — ingests merge requests, pipelines, jobs,
 * environments, deployments, and members from a GitLab project and
 * produces entities and relationships for the knowledge graph.
 *
 * Since this collector is not yet connected to real API calls, it
 * generates synthetic data that mirrors the shape of real GitLab API
 * responses for development and testing purposes.
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
// Internal Types
// ---------------------------------------------------------------------------

/** Synthetic merge request data. */
interface MockMR {
  iid: number;
  title: string;
  author: string;
  reviewers: string[];
  state: 'opened' | 'closed' | 'merged';
  labels: string[];
}

/** Synthetic pipeline data. */
interface MockPipeline {
  id: number;
  ref: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  triggeredBy: string;
  jobs: Array<{ name: string; stage: string; steps: string[] }>;
}

/** Synthetic environment data. */
interface MockEnvironment {
  name: string;
  tier: 'production' | 'staging' | 'development';
  url: string;
}

/** Synthetic deployment data. */
interface MockDeployment {
  environment: string;
  sha: string;
  deployer: string;
  status: 'success' | 'failed' | 'running';
  pipelineId: number;
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS = ['alice', 'bob', 'carol', 'dave', 'eve'];

const MOCK_TEAMS = [
  { name: 'backend-group', members: ['alice', 'bob', 'carol'] },
  { name: 'devops-group', members: ['dave', 'eve'] },
];

const MOCK_MRS: MockMR[] = [
  { iid: 42, title: 'feat: add OAuth2 login', author: 'alice', reviewers: ['bob', 'carol'], state: 'merged', labels: ['feature'] },
  { iid: 43, title: 'fix: database connection pool leak', author: 'bob', reviewers: ['alice'], state: 'merged', labels: ['bugfix'] },
  { iid: 44, title: 'chore: migrate CI to rules-based pipelines', author: 'dave', reviewers: ['eve', 'alice'], state: 'opened', labels: ['chore', 'ci'] },
];

const MOCK_PIPELINES: MockPipeline[] = [
  {
    id: 1001,
    ref: 'main',
    status: 'success',
    triggeredBy: 'alice',
    jobs: [
      { name: 'lint', stage: 'test', steps: ['Checkout', 'Install', 'ESLint'] },
      { name: 'unit-test', stage: 'test', steps: ['Checkout', 'Install', 'Jest'] },
      { name: 'build', stage: 'build', steps: ['Checkout', 'Install', 'Compile'] },
      { name: 'deploy-staging', stage: 'deploy', steps: ['Checkout', 'Configure', 'Deploy'] },
    ],
  },
  {
    id: 1002,
    ref: 'main',
    status: 'success',
    triggeredBy: 'dave',
    jobs: [
      { name: 'deploy-production', stage: 'deploy', steps: ['Checkout', 'Configure', 'Deploy', 'Verify'] },
    ],
  },
];

const MOCK_ENVIRONMENTS: MockEnvironment[] = [
  { name: 'production', tier: 'production', url: 'https://app.example.com' },
  { name: 'staging', tier: 'staging', url: 'https://staging.example.com' },
];

const MOCK_DEPLOYMENTS: MockDeployment[] = [
  { environment: 'staging', sha: 'a1b2c3d4', deployer: 'alice', status: 'success', pipelineId: 1001 },
  { environment: 'production', sha: 'e5f6a7b8', deployer: 'dave', status: 'success', pipelineId: 1002 },
];

// ---------------------------------------------------------------------------
// GitLabCollector
// ---------------------------------------------------------------------------

/**
 * Collects merge requests, pipelines, jobs, environments, and
 * deployment data from a GitLab project.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and GitLab URL.
 * 2. {@link validate} — verify the GitLab URL is well-formed.
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic GitLab data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new GitLabCollector('https://gitlab.com/org/project');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
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

    this.initialized = true;
    logger.info('GitLabCollector initialized', { gitlabUrl: this.gitlabUrl });
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

    // Build entities and relationships from synthetic data
    const entities = this.buildEntities();
    const relationships = this.buildRelationships(entities);

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
        items_processed: MOCK_MRS.length + MOCK_PIPELINES.length + MOCK_DEPLOYMENTS.length + MOCK_ENVIRONMENTS.length,
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
   * Build knowledge graph entities from synthetic GitLab data.
   *
   * Creates:
   * - `user` entities for each mock user
   * - `team` entities for each mock group
   * - `workflow` entities for each merge request workflow
   * - `pipeline` entities for each CI/CD pipeline
   * - `job` entities for each job within pipelines
   * - `step` entities for each step within jobs
   * - `environment` entities for each deployment environment
   * - `deployment` entities for each deployment event
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- User entities ---
    for (const username of MOCK_USERS) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          platform: 'gitlab',
          gitlab_url: this.gitlabUrl,
        }, ['member']),
      );
    }

    // --- Team entities ---
    for (const team of MOCK_TEAMS) {
      entities.push(
        this.makeEntity('team', team.name, {
          members: team.members,
          member_count: team.members.length,
          platform: 'gitlab',
        }, ['group']),
      );
    }

    // --- Workflow entities (merge requests) ---
    for (const mr of MOCK_MRS) {
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
    for (const pipeline of MOCK_PIPELINES) {
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
    for (const env of MOCK_ENVIRONMENTS) {
      entities.push(
        this.makeEntity('environment', env.name, {
          tier: env.tier,
          url: env.url,
          platform: 'gitlab',
        }, [env.tier]),
      );
    }

    // --- Deployment entities ---
    for (const deploy of MOCK_DEPLOYMENTS) {
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
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const teams = entities.filter((e) => e.type === 'team');
    const pipelines = entities.filter((e) => e.type === 'pipeline');
    const jobs = entities.filter((e) => e.type === 'job');
    const workflows = entities.filter((e) => e.type === 'workflow');
    const deployments = entities.filter((e) => e.type === 'deployment');
    const environments = entities.filter((e) => e.type === 'environment');

    // User → Pipeline (triggers)
    for (const pipeline of pipelines) {
      const triggeredBy = pipeline.properties['triggered_by'] as string;
      const userEntity = users.find((u) => u.name === triggeredBy);
      if (userEntity) {
        relationships.push(this.makeRel('triggers', userEntity.id, pipeline.id, {
          pipeline_id: pipeline.properties['pipeline_id'],
        }));
      }
    }

    // User reviews MR (reviewer → workflow)
    for (const mr of MOCK_MRS) {
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
    for (const pipeline of MOCK_PIPELINES) {
      const pipelineEntity = pipelines.find(
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
    for (const pipeline of MOCK_PIPELINES) {
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
