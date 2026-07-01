/**
 * @module @recurrsive/collectors/github/collector
 *
 * GitHub App Collector — ingests pull requests, issues, reviews,
 * workflows, and deployments from a GitHub repository and produces
 * entities and relationships for the knowledge graph.
 *
 * Since this collector is not yet connected to real API calls, it
 * generates synthetic data that mirrors the shape of real GitHub API
 * responses for development and testing purposes.
 *
 * Produces entities:
 * - `workflow` — CI/CD workflow definitions
 * - `pipeline` — release pipelines
 * - `job` — individual CI jobs
 * - `step` — steps within jobs
 * - `deployment` — deployment events
 * - `user` — GitHub users (authors, reviewers)
 * - `team` — GitHub teams
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

const logger = createLogger({ context: { module: 'github-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Synthetic pull request data. */
interface MockPR {
  number: number;
  title: string;
  author: string;
  reviewers: string[];
  state: 'open' | 'closed' | 'merged';
  labels: string[];
}

/** Synthetic workflow data. */
interface MockWorkflow {
  name: string;
  trigger: string;
  jobs: Array<{ name: string; runsOn: string; steps: string[] }>;
}

/** Synthetic deployment data. */
interface MockDeployment {
  environment: string;
  sha: string;
  creator: string;
  status: 'success' | 'failure' | 'pending';
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS = ['alice', 'bob', 'carol', 'dave', 'eve'];

const MOCK_TEAMS = [
  { name: 'platform-team', members: ['alice', 'bob'] },
  { name: 'frontend-team', members: ['carol', 'dave'] },
  { name: 'sre-team', members: ['eve', 'alice'] },
];

const MOCK_PRS: MockPR[] = [
  { number: 101, title: 'feat: add user auth', author: 'alice', reviewers: ['bob', 'carol'], state: 'merged', labels: ['feature'] },
  { number: 102, title: 'fix: resolve race condition', author: 'bob', reviewers: ['alice'], state: 'merged', labels: ['bugfix'] },
  { number: 103, title: 'chore: upgrade dependencies', author: 'carol', reviewers: ['dave'], state: 'open', labels: ['chore'] },
];

const MOCK_WORKFLOWS: MockWorkflow[] = [
  {
    name: 'CI Pipeline',
    trigger: 'push',
    jobs: [
      { name: 'lint', runsOn: 'ubuntu-latest', steps: ['Checkout', 'Install', 'Lint'] },
      { name: 'test', runsOn: 'ubuntu-latest', steps: ['Checkout', 'Install', 'Test'] },
      { name: 'build', runsOn: 'ubuntu-latest', steps: ['Checkout', 'Install', 'Build'] },
    ],
  },
  {
    name: 'Deploy Production',
    trigger: 'release',
    jobs: [
      { name: 'deploy', runsOn: 'ubuntu-latest', steps: ['Checkout', 'Configure AWS', 'Deploy'] },
    ],
  },
];

const MOCK_DEPLOYMENTS: MockDeployment[] = [
  { environment: 'production', sha: 'abc1234', creator: 'alice', status: 'success' },
  { environment: 'staging', sha: 'def5678', creator: 'bob', status: 'success' },
];

// ---------------------------------------------------------------------------
// GitHubCollector
// ---------------------------------------------------------------------------

/**
 * Collects pull requests, issues, code reviews, workflows, and
 * deployment data from a GitHub repository.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and repo URL.
 * 2. {@link validate} — verify the repo URL is well-formed.
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic GitHub data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new GitHubCollector('https://github.com/org/repo');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class GitHubCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'github';
  /** @inheritdoc */
  readonly name = 'GitHub App Collector';
  /** @inheritdoc */
  readonly description = 'Collects PRs, issues, reviews, workflows, and deployments from GitHub repositories';
  /** @inheritdoc */
  readonly type: CollectorType = 'github';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** GitHub repository URL. */
  private repoUrl: string;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param repoUrl - GitHub repository URL (e.g. `https://github.com/org/repo`).
   */
  constructor(repoUrl: string) {
    this.repoUrl = repoUrl;
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

    if (typeof config.custom['repoUrl'] === 'string') {
      this.repoUrl = config.custom['repoUrl'];
    }

    this.initialized = true;
    logger.info('GitHubCollector initialized', { repoUrl: this.repoUrl });
  }

  /**
   * Validate that the configured repository URL is well-formed.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.repoUrl) {
      errors.push('Repository URL is required');
    } else {
      try {
        const url = new URL(this.repoUrl);
        if (!url.hostname.includes('github')) {
          errors.push(`'${this.repoUrl}' does not appear to be a GitHub URL`);
        }
      } catch {
        errors.push(`'${this.repoUrl}' is not a valid URL`);
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
        'GitHubCollector has not been initialized. Call initialize() first.',
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

    logger.info('GitHubCollector collection complete', {
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
        items_processed: MOCK_PRS.length + MOCK_WORKFLOWS.length + MOCK_DEPLOYMENTS.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('GitHubCollector disposed', { repoUrl: this.repoUrl });
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
      qualified_name: qualifiedName(this.repoName(), name),
      source: this.id,
      properties: props,
      tags: ['github', ...tags],
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
   * Extract the repository name from the URL.
   */
  private repoName(): string {
    try {
      const parts = new URL(this.repoUrl).pathname.split('/').filter(Boolean);
      return parts.slice(0, 2).join('/') || 'unknown/repo';
    } catch {
      return 'unknown/repo';
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from synthetic GitHub data.
   *
   * Creates:
   * - `user` entities for each mock user
   * - `team` entities for each mock team
   * - `workflow` entities for each CI workflow
   * - `job` entities for each job within workflows
   * - `step` entities for each step within jobs
   * - `pipeline` entity for the release pipeline
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
          platform: 'github',
          repo_url: this.repoUrl,
        }, ['contributor']),
      );
    }

    // --- Team entities ---
    for (const team of MOCK_TEAMS) {
      entities.push(
        this.makeEntity('team', team.name, {
          members: team.members,
          member_count: team.members.length,
          platform: 'github',
        }, ['organization']),
      );
    }

    // --- Workflow entities (with jobs and steps) ---
    for (const wf of MOCK_WORKFLOWS) {
      entities.push(
        this.makeEntity('workflow', wf.name, {
          trigger: wf.trigger,
          job_count: wf.jobs.length,
          platform: 'github-actions',
          repo_url: this.repoUrl,
        }, ['github-actions', wf.trigger]),
      );

      for (const job of wf.jobs) {
        entities.push(
          this.makeEntity('job', `${wf.name}.${job.name}`, {
            runs_on: job.runsOn,
            step_count: job.steps.length,
            workflow_name: wf.name,
            platform: 'github-actions',
          }, ['github-actions']),
        );

        for (const stepName of job.steps) {
          entities.push(
            this.makeEntity('step', `${wf.name}.${job.name}.${stepName}`, {
              job_name: job.name,
              workflow_name: wf.name,
              platform: 'github-actions',
            }, ['github-actions']),
          );
        }
      }
    }

    // --- Pipeline entity ---
    entities.push(
      this.makeEntity('pipeline', 'release-pipeline', {
        stages: ['build', 'test', 'deploy'],
        platform: 'github',
        repo_url: this.repoUrl,
      }, ['release']),
    );

    // --- Deployment entities ---
    for (const deploy of MOCK_DEPLOYMENTS) {
      entities.push(
        this.makeEntity('deployment', `deploy-${deploy.environment}`, {
          environment: deploy.environment,
          sha: deploy.sha,
          creator: deploy.creator,
          status: deploy.status,
          platform: 'github',
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
   * - `triggers` — workflow → job
   * - `reviews` — user → user (reviewer → PR author)
   * - `owns` — team → workflow
   * - `deploys_to` — pipeline → deployment
   * - `depends_on` — job → job (test depends on lint, build depends on test)
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const workflows = entities.filter((e) => e.type === 'workflow');
    const jobs = entities.filter((e) => e.type === 'job');
    const teams = entities.filter((e) => e.type === 'team');
    const deployments = entities.filter((e) => e.type === 'deployment');
    const pipelineEntity = entities.find((e) => e.type === 'pipeline');
    const users = entities.filter((e) => e.type === 'user');

    // Workflow → Job (triggers)
    for (const wf of workflows) {
      const wfName = wf.name;
      const wfJobs = jobs.filter(
        (j) => j.properties['workflow_name'] === wfName,
      );
      for (const job of wfJobs) {
        relationships.push(this.makeRel('triggers', wf.id, job.id, {
          workflow: wfName,
        }));
      }
    }

    // User reviews (reviewer → author mapping from PRs)
    for (const pr of MOCK_PRS) {
      const authorEntity = users.find((u) => u.name === pr.author);
      if (!authorEntity) continue;
      for (const reviewer of pr.reviewers) {
        const reviewerEntity = users.find((u) => u.name === reviewer);
        if (reviewerEntity) {
          relationships.push(this.makeRel('reviews', reviewerEntity.id, authorEntity.id, {
            pr_number: pr.number,
            pr_title: pr.title,
          }));
        }
      }
    }

    // Team → Workflow (owns)
    if (teams.length > 0 && workflows.length > 0) {
      // First team owns first workflow, etc.
      for (let i = 0; i < workflows.length && i < teams.length; i++) {
        relationships.push(this.makeRel('owns', teams[i]!.id, workflows[i]!.id));
      }
    }

    // Pipeline → Deployment (deploys_to)
    if (pipelineEntity) {
      for (const deploy of deployments) {
        relationships.push(this.makeRel('deploys_to', pipelineEntity.id, deploy.id, {
          environment: deploy.properties['environment'],
        }));
      }
    }

    // Job → Job (depends_on) — test depends on lint within same workflow
    for (const wf of MOCK_WORKFLOWS) {
      const wfJobs = jobs.filter(
        (j) => j.properties['workflow_name'] === wf.name,
      );
      for (let i = 1; i < wfJobs.length; i++) {
        relationships.push(
          this.makeRel('depends_on', wfJobs[i]!.id, wfJobs[i - 1]!.id),
        );
      }
    }

    return relationships;
  }
}
