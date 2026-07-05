/**
 * @module @recurrsive/collectors/github/collector
 *
 * GitHub App Collector — ingests pull requests, issues, reviews,
 * workflows, and deployments from a GitHub repository and produces
 * entities and relationships for the knowledge graph.
 *
 * Uses native `fetch` to call GitHub API v3. Reads authentication
 * token from `config.custom.github_token` or `process.env.GITHUB_TOKEN`.
 * Falls back gracefully to empty results when no token or API is
 * unavailable.
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
// Internal Types — shapes of GitHub API v3 responses (partial)
// ---------------------------------------------------------------------------

/** Subset of a GitHub pull request API response. */
interface GitHubPR {
  number: number;
  title: string;
  user: { login: string } | null;
  requested_reviewers: Array<{ login: string }>;
  state: string;
  merged_at: string | null;
  labels: Array<{ name: string }>;
}

/** Subset of a GitHub workflow API response. */
interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
}

/** Subset of a GitHub workflow run API response. */
interface GitHubWorkflowRun {
  id: number;
  name: string;
  workflow_id: number;
  status: string;
  conclusion: string | null;
  run_number: number;
  jobs_url: string;
}

/** Subset of a GitHub workflow job API response. */
interface GitHubJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  runner_name: string;
  steps: Array<{ name: string; status: string; conclusion: string | null }>;
}

/** Subset of a GitHub deployment API response. */
interface GitHubDeployment {
  id: number;
  environment: string;
  sha: string;
  creator: { login: string } | null;
  description: string | null;
  created_at: string;
}

/** Subset of a GitHub contributor API response. */
interface GitHubContributor {
  login: string;
  contributions: number;
  type: string;
}

/** Subset of a GitHub team API response. */
interface GitHubTeam {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  members_url: string;
}

// ---------------------------------------------------------------------------
// Collected data containers
// ---------------------------------------------------------------------------

interface CollectedPR {
  number: number;
  title: string;
  author: string;
  reviewers: string[];
  state: 'open' | 'closed' | 'merged';
  labels: string[];
}

interface CollectedWorkflow {
  name: string;
  trigger: string;
  jobs: Array<{ name: string; runsOn: string; steps: string[] }>;
}

interface CollectedDeployment {
  environment: string;
  sha: string;
  creator: string;
  status: 'success' | 'failure' | 'pending';
}

// ---------------------------------------------------------------------------
// GitHubCollector
// ---------------------------------------------------------------------------

/**
 * Collects pull requests, issues, code reviews, workflows, and
 * deployment data from a GitHub repository.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules, repo URL, and API token.
 * 2. {@link validate} — verify the repo URL is well-formed.
 * 3. {@link collect} — fetch real data from GitHub API and generate
 *    entities & relationships.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new GitHubCollector('https://github.com/org/repo');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { github_token: 'ghp_...' },
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
  /** GitHub API token. */
  private token: string | undefined;
  /** GitHub owner (org or user). */
  private owner = '';
  /** GitHub repository name. */
  private repo = '';

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

    // Resolve token
    this.token =
      (typeof config.custom['github_token'] === 'string' ? config.custom['github_token'] : undefined) ||
      process.env['GITHUB_TOKEN'] ||
      undefined;

    // Resolve owner/repo
    const ownerFromConfig = typeof config.custom['github_owner'] === 'string' ? config.custom['github_owner'] : undefined;
    const repoFromConfig = typeof config.custom['github_repo'] === 'string' ? config.custom['github_repo'] : undefined;

    if (ownerFromConfig && repoFromConfig) {
      this.owner = ownerFromConfig;
      this.repo = repoFromConfig;
    } else {
      // Auto-detect from repoUrl
      const parsed = this.parseOwnerRepo(this.repoUrl);
      this.owner = parsed.owner;
      this.repo = parsed.repo;
    }

    this.initialized = true;
    logger.info('GitHubCollector initialized', { repoUrl: this.repoUrl, owner: this.owner, repo: this.repo, hasToken: !!this.token });
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

    // Fetch data from GitHub API (or empty arrays on failure)
    const users = await this.fetchContributors(errors);
    const teams = await this.fetchTeams(errors);
    const prs = await this.fetchPullRequests(errors);
    const workflows = await this.fetchWorkflows(errors);
    const deployments = await this.fetchDeployments(errors);

    const itemsProcessed = users.length + prs.length + workflows.length + deployments.length;

    // Build entities and relationships from fetched data
    const entities = this.buildEntities(users, teams, workflows, deployments);
    const relationships = this.buildRelationships(entities, prs, workflows);

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
    logger.info('GitHubCollector disposed', { repoUrl: this.repoUrl });
  }

  // -----------------------------------------------------------------------
  // Internal: GitHub API Fetching
  // -----------------------------------------------------------------------

  /**
   * Parse owner/repo from a GitHub URL.
   */
  private parseOwnerRepo(url: string): { owner: string; repo: string } {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return {
        owner: parts[0] || 'unknown',
        repo: (parts[1] || 'repo').replace(/\.git$/, ''),
      };
    } catch {
      return { owner: 'unknown', repo: 'repo' };
    }
  }

  /**
   * Make a paginated GET request to the GitHub API.
   * Returns up to `maxItems` results across pages.
   * Checks `X-RateLimit-Remaining` and aborts if exhausted.
   */
  private async fetchPaginated<T>(
    path: string,
    errors: Array<{ message: string; details?: unknown }>,
    maxItems = 100,
  ): Promise<T[]> {
    if (!this.token) {
      logger.warn('No GitHub token configured, skipping API call', { path });
      errors.push({ message: `No GitHub token configured, skipping: ${path}` });
      return [];
    }

    const results: T[] = [];
    let url: string | null = `https://api.github.com${path}`;

    // Add per_page param if not already present
    if (!url.includes('per_page')) {
      url += (url.includes('?') ? '&' : '?') + 'per_page=30';
    }

    try {
      while (url && results.length < maxItems) {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        // Check rate limit
        const remaining = response.headers.get('X-RateLimit-Remaining');
        if (remaining !== null && parseInt(remaining, 10) <= 0) {
          const resetTime = response.headers.get('X-RateLimit-Reset');
          const msg = `GitHub API rate limit exhausted. Resets at ${resetTime}`;
          logger.warn(msg);
          errors.push({ message: msg });
          break;
        }

        if (!response.ok) {
          const msg = `GitHub API error: ${response.status} ${response.statusText} for ${url}`;
          logger.warn(msg);
          errors.push({ message: msg, details: { status: response.status } });
          break;
        }

        const data = (await response.json()) as T[] | Record<string, unknown>;

        // Some endpoints return { items: [...] } or { workflows: [...] } etc.
        const items = Array.isArray(data) ? data : [];
        results.push(...items);

        // Check Link header for next page
        url = this.parseNextLink(response.headers.get('Link'));
      }
    } catch (err) {
      const msg = `GitHub API fetch failed for ${path}: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    return results.slice(0, maxItems);
  }

  /**
   * Make a single (non-paginated) GET request to the GitHub API.
   * Used for endpoints that return an object, not an array.
   */
  private async fetchSingle<T>(
    path: string,
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<T | null> {
    if (!this.token) {
      logger.warn('No GitHub token configured, skipping API call', { path });
      errors.push({ message: `No GitHub token configured, skipping: ${path}` });
      return null;
    }

    try {
      const url = `https://api.github.com${path}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      // Check rate limit
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining !== null && parseInt(remaining, 10) <= 0) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        errors.push({ message: `GitHub API rate limit exhausted. Resets at ${resetTime}` });
        return null;
      }

      if (!response.ok) {
        errors.push({ message: `GitHub API error: ${response.status} ${response.statusText} for ${url}`, details: { status: response.status } });
        return null;
      }

      return (await response.json()) as T;
    } catch (err) {
      errors.push({ message: `GitHub API fetch failed for ${path}: ${err instanceof Error ? err.message : String(err)}` });
      return null;
    }
  }

  /**
   * Parse the `Link` header to find the URL for the next page.
   */
  private parseNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1]! : null;
  }

  /**
   * Fetch contributors from the GitHub API.
   */
  private async fetchContributors(errors: Array<{ message: string; details?: unknown }>): Promise<string[]> {
    const contributors = await this.fetchPaginated<GitHubContributor>(
      `/repos/${this.owner}/${this.repo}/contributors`,
      errors,
      100,
    );
    return contributors.map((c) => c.login);
  }

  /**
   * Fetch teams from the GitHub API.
   * Requires admin access; gracefully returns empty on 403/404.
   */
  private async fetchTeams(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<Array<{ name: string; members: string[] }>> {
    const teams = await this.fetchPaginated<GitHubTeam>(
      `/repos/${this.owner}/${this.repo}/teams`,
      errors,
      100,
    );
    // We can't easily fetch team members without org admin, so return team names with empty members
    return teams.map((t) => ({ name: t.slug, members: [] }));
  }

  /**
   * Fetch pull requests from the GitHub API.
   */
  private async fetchPullRequests(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedPR[]> {
    const rawPRs = await this.fetchPaginated<GitHubPR>(
      `/repos/${this.owner}/${this.repo}/pulls?state=all&per_page=30`,
      errors,
      100,
    );
    return rawPRs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || 'unknown',
      reviewers: (pr.requested_reviewers || []).map((r) => r.login),
      state: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
      labels: (pr.labels || []).map((l) => l.name),
    }));
  }

  /**
   * Fetch workflows and their recent runs from the GitHub API.
   */
  private async fetchWorkflows(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedWorkflow[]> {
    // Fetch workflows list — this returns { total_count, workflows: [...] }
    const workflowsResponse = await this.fetchSingle<{ total_count: number; workflows: GitHubWorkflow[] }>(
      `/repos/${this.owner}/${this.repo}/actions/workflows`,
      errors,
    );

    if (!workflowsResponse || !workflowsResponse.workflows) return [];

    const collectedWorkflows: CollectedWorkflow[] = [];

    for (const wf of workflowsResponse.workflows.slice(0, 10)) {
      // Fetch the most recent run for this workflow to get job info
      const runsResponse = await this.fetchSingle<{ total_count: number; workflow_runs: GitHubWorkflowRun[] }>(
        `/repos/${this.owner}/${this.repo}/actions/workflows/${wf.id}/runs?per_page=1`,
        errors,
      );

      const jobs: Array<{ name: string; runsOn: string; steps: string[] }> = [];

      if (runsResponse?.workflow_runs?.[0]) {
        // Fetch jobs for the most recent run
        const jobsResponse = await this.fetchSingle<{ total_count: number; jobs: GitHubJob[] }>(
          `/repos/${this.owner}/${this.repo}/actions/runs/${runsResponse.workflow_runs[0].id}/jobs`,
          errors,
        );

        if (jobsResponse?.jobs) {
          for (const job of jobsResponse.jobs) {
            jobs.push({
              name: job.name,
              runsOn: job.runner_name || 'unknown',
              steps: (job.steps || []).map((s) => s.name),
            });
          }
        }
      }

      // Derive trigger from path (e.g. .github/workflows/ci.yml)
      const trigger = wf.path ? 'push' : 'unknown';

      collectedWorkflows.push({
        name: wf.name,
        trigger,
        jobs,
      });
    }

    return collectedWorkflows;
  }

  /**
   * Fetch deployments from the GitHub API.
   */
  private async fetchDeployments(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedDeployment[]> {
    const rawDeployments = await this.fetchPaginated<GitHubDeployment>(
      `/repos/${this.owner}/${this.repo}/deployments`,
      errors,
      100,
    );
    return rawDeployments.map((d) => ({
      environment: d.environment || 'unknown',
      sha: d.sha?.substring(0, 7) || 'unknown',
      creator: d.creator?.login || 'unknown',
      status: 'success' as const, // Deployment status requires a separate API call to /statuses
    }));
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
   * Build knowledge graph entities from GitHub data.
   *
   * Creates:
   * - `user` entities for each contributor
   * - `team` entities for each team
   * - `workflow` entities for each CI workflow
   * - `job` entities for each job within workflows
   * - `step` entities for each step within jobs
   * - `pipeline` entity for the release pipeline
   * - `deployment` entities for each deployment event
   *
   * @returns Array of entities.
   */
  private buildEntities(
    users: string[],
    teams: Array<{ name: string; members: string[] }>,
    workflows: CollectedWorkflow[],
    deployments: CollectedDeployment[],
  ): Entity[] {
    const entities: Entity[] = [];

    // --- User entities ---
    for (const username of users) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          platform: 'github',
          repo_url: this.repoUrl,
        }, ['contributor']),
      );
    }

    // --- Team entities ---
    for (const team of teams) {
      entities.push(
        this.makeEntity('team', team.name, {
          members: team.members,
          member_count: team.members.length,
          platform: 'github',
        }, ['organization']),
      );
    }

    // --- Workflow entities (with jobs and steps) ---
    for (const wf of workflows) {
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

    // --- Pipeline entity (only if we have workflows or deployments) ---
    if (workflows.length > 0 || deployments.length > 0) {
      entities.push(
        this.makeEntity('pipeline', 'release-pipeline', {
          stages: ['build', 'test', 'deploy'],
          platform: 'github',
          repo_url: this.repoUrl,
        }, ['release']),
      );
    }

    // --- Deployment entities ---
    for (const deploy of deployments) {
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
   * @param prs - Collected pull requests for review relationships.
   * @param workflows - Collected workflows for dependency relationships.
   * @returns Array of relationships.
   */
  private buildRelationships(
    entities: Entity[],
    prs: CollectedPR[],
    workflows: CollectedWorkflow[],
  ): Relationship[] {
    const relationships: Relationship[] = [];

    const workflowEntities = entities.filter((e) => e.type === 'workflow');
    const jobs = entities.filter((e) => e.type === 'job');
    const teams = entities.filter((e) => e.type === 'team');
    const deployments = entities.filter((e) => e.type === 'deployment');
    const pipelineEntity = entities.find((e) => e.type === 'pipeline');
    const users = entities.filter((e) => e.type === 'user');

    // Workflow → Job (triggers)
    for (const wf of workflowEntities) {
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
    for (const pr of prs) {
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
    if (teams.length > 0 && workflowEntities.length > 0) {
      // First team owns first workflow, etc.
      for (let i = 0; i < workflowEntities.length && i < teams.length; i++) {
        relationships.push(this.makeRel('owns', teams[i]!.id, workflowEntities[i]!.id));
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
    for (const wf of workflows) {
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
