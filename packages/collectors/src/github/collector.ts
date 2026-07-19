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
  state: string;
  merged_at: string | null;
  labels: Array<{ name: string }>;
}

/** Subset of a GitHub pull request review API response. */
interface GitHubPRReview {
  user: { login: string } | null;
  state: string;
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
  /**
   * Logins of users who actually submitted a review on this PR (from the
   * /pulls/{n}/reviews API) — NOT requested reviewers, who may never
   * have reviewed anything. Empty when reviews were not fetched.
   */
  reviewers: string[];
  state: 'open' | 'closed' | 'merged';
  labels: string[];
}

interface CollectedWorkflow {
  name: string;
  trigger: string;
  jobs: Array<{ name: string; runsOn: string; steps: string[]; needs: string[] }>;
}

interface CollectedDeployment {
  environment: string;
  sha: string;
  creator: string;
  /** Deployment creation timestamp as reported by the API. */
  createdAt?: string;
  /**
   * Latest deployment status reported by the GitHub deployment statuses
   * API. Omitted entirely when no status could be fetched — never guessed.
   */
  status?: string;
}

/** Workflow definition details parsed from the workflow YAML file. */
interface ParsedWorkflowDef {
  /** Trigger event names from the top-level `on:` key. */
  triggers: string[];
  /** Jobs declared in the file, with their `needs:` dependencies. */
  jobs: Array<{ id: string; name: string | null; needs: string[] }>;
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

  /** Per-request timeout for GitHub API calls, in milliseconds. */
  private static readonly FETCH_TIMEOUT_MS = 10_000;

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
   * API path prefix for the configured repository, with owner and repo
   * URL-encoded so unusual characters cannot break or redirect the path.
   */
  private repoApiPath(): string {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
  }

  /**
   * Make a paginated GET request to the GitHub API.
   * Returns up to `maxItems` results across pages.
   * Checks `X-RateLimit-Remaining` and aborts if exhausted.
   * When the cap cuts off further pages (or drops fetched items), a
   * truncation note is recorded in `errors` unless
   * `options.noteTruncation` is false (for intentional latest-only
   * lookups such as deployment statuses).
   */
  private async fetchPaginated<T>(
    path: string,
    errors: Array<{ message: string; details?: unknown }>,
    maxItems = 100,
    options: { noteTruncation?: boolean } = {},
  ): Promise<T[]> {
    if (!this.token) {
      logger.warn('No GitHub token configured, skipping API call', { path });
      errors.push({ message: `No GitHub token configured, skipping: ${path}` });
      return [];
    }

    const results: T[] = [];
    let url: string | null = `https://api.github.com${path}`;
    let cappedWithMorePages = false;

    // Add per_page param if not already present
    if (!url.includes('per_page')) {
      url += (url.includes('?') ? '&' : '?') + 'per_page=30';
    }

    try {
      while (url) {
        if (results.length >= maxItems) {
          // A next page exists but the cap stops us here.
          cappedWithMorePages = true;
          break;
        }
        const response = await this.fetchWithTimeout(url);

        const remaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimited = remaining !== null && parseInt(remaining, 10) <= 0;
        const resetTime = response.headers.get('X-RateLimit-Reset');

        if (!response.ok) {
          const msg = rateLimited
            ? `GitHub API rate limit exhausted (${response.status} for ${url}). Resets at ${resetTime}`
            : `GitHub API error: ${response.status} ${response.statusText} for ${url}`;
          logger.warn(msg);
          errors.push({ message: msg, details: { status: response.status } });
          break;
        }

        const data = (await response.json()) as T[] | Record<string, unknown>;

        // Some endpoints return { items: [...] } or { workflows: [...] } etc.
        const items = Array.isArray(data) ? data : [];
        results.push(...items);

        // Rate limit exhausted: keep what this (successful) response
        // returned, but stop paginating further.
        if (rateLimited) {
          const msg = `GitHub API rate limit exhausted after ${url}; stopping pagination. Resets at ${resetTime}`;
          logger.warn(msg);
          errors.push({ message: msg });
          break;
        }

        // Check Link header for next page
        url = this.parseNextLink(response.headers.get('Link'));
      }
    } catch (err) {
      const msg = `GitHub API fetch failed for ${path}: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    // Record silent truncation honestly: either more pages existed at the
    // cap, or the final slice below drops already-fetched items.
    if ((options.noteTruncation ?? true) && (cappedWithMorePages || results.length > maxItems)) {
      const msg = `GitHub API results for ${path} truncated to ${maxItems} items; additional items exist but were not collected`;
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
      const response = await this.fetchWithTimeout(url);

      const remaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimited = remaining !== null && parseInt(remaining, 10) <= 0;
      const resetTime = response.headers.get('X-RateLimit-Reset');

      if (!response.ok) {
        const msg = rateLimited
          ? `GitHub API rate limit exhausted (${response.status} for ${url}). Resets at ${resetTime}`
          : `GitHub API error: ${response.status} ${response.statusText} for ${url}`;
        errors.push({ message: msg, details: { status: response.status } });
        return null;
      }

      // Parse the current (successful) response before reporting
      // rate-limit exhaustion — the data we already paid for is real.
      const parsed = (await response.json()) as T;

      if (rateLimited) {
        errors.push({ message: `GitHub API rate limit exhausted after ${url}; subsequent calls may fail. Resets at ${resetTime}` });
      }

      return parsed;
    } catch (err) {
      errors.push({ message: `GitHub API fetch failed for ${path}: ${err instanceof Error ? err.message : String(err)}` });
      return null;
    }
  }

  /**
   * Perform a GET against the GitHub API with auth headers and a
   * {@link GitHubCollector.FETCH_TIMEOUT_MS} abort timeout.
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GitHubCollector.FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
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
      `${this.repoApiPath()}/contributors`,
      errors,
      100,
    );
    return contributors.map((c) => c.login);
  }

  /**
   * Fetch teams from the GitHub API.
   * Requires admin access; gracefully returns empty on 403/404.
   * Team membership is NOT fetched (requires org admin), so no member
   * data is returned — it must not be reported as an empty roster.
   */
  private async fetchTeams(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<Array<{ name: string }>> {
    const teams = await this.fetchPaginated<GitHubTeam>(
      `${this.repoApiPath()}/teams`,
      errors,
      100,
    );
    return teams.map((t) => ({ name: t.slug }));
  }

  /**
   * Fetch pull requests and their submitted reviews from the GitHub API.
   *
   * Reviewers come from the /pulls/{n}/reviews endpoint — the users who
   * actually reviewed — not from `requested_reviewers` (users merely
   * asked to review). Review lookups are capped; PRs beyond the cap get
   * no reviewer data and the omission is recorded.
   */
  private async fetchPullRequests(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedPR[]> {
    const rawPRs = await this.fetchPaginated<GitHubPR>(
      `${this.repoApiPath()}/pulls?state=all&per_page=30`,
      errors,
      100,
    );

    // Cap per-PR review lookups to bound API usage.
    const REVIEW_LOOKUP_LIMIT = 30;
    if (rawPRs.length > REVIEW_LOOKUP_LIMIT) {
      errors.push({
        message: `Review lookups only performed for the first ${REVIEW_LOOKUP_LIMIT} of ${rawPRs.length} pull requests; reviewer data omitted for the rest`,
      });
    }

    const collected: CollectedPR[] = [];
    for (let i = 0; i < rawPRs.length; i++) {
      const pr = rawPRs[i]!;
      const author = pr.user?.login || 'unknown';

      let reviewers: string[] = [];
      if (i < REVIEW_LOOKUP_LIMIT) {
        const reviews = await this.fetchPaginated<GitHubPRReview>(
          `${this.repoApiPath()}/pulls/${pr.number}/reviews`,
          errors,
          100,
        );
        // Unique submitters, excluding the PR author (self-comments are
        // not code reviews).
        reviewers = [...new Set(
          reviews
            .map((r) => r.user?.login)
            .filter((login): login is string => typeof login === 'string' && login !== author),
        )];
      }

      collected.push({
        number: pr.number,
        title: pr.title,
        author,
        reviewers,
        state: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
        labels: (pr.labels || []).map((l) => l.name),
      });
    }

    return collected;
  }

  /**
   * Fetch workflows and their recent runs from the GitHub API.
   */
  private async fetchWorkflows(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedWorkflow[]> {
    // Fetch workflows list — this returns { total_count, workflows: [...] }
    const workflowsResponse = await this.fetchSingle<{ total_count: number; workflows: GitHubWorkflow[] }>(
      `${this.repoApiPath()}/actions/workflows`,
      errors,
    );

    if (!workflowsResponse || !workflowsResponse.workflows) return [];

    const collectedWorkflows: CollectedWorkflow[] = [];

    // Cap per-workflow processing; record honestly when workflows are dropped.
    const WORKFLOW_LIMIT = 10;
    if (workflowsResponse.workflows.length > WORKFLOW_LIMIT) {
      const msg = `Only the first ${WORKFLOW_LIMIT} of ${workflowsResponse.workflows.length} workflows were processed; the rest were not collected`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    for (const wf of workflowsResponse.workflows.slice(0, WORKFLOW_LIMIT)) {
      // Fetch and parse the workflow definition file for the real
      // trigger ('on:') and job dependency ('needs:') declarations.
      const parsedDef = await this.fetchWorkflowDefinition(wf.path, errors);

      // Fetch the most recent run for this workflow to get job info
      const runsResponse = await this.fetchSingle<{ total_count: number; workflow_runs: GitHubWorkflowRun[] }>(
        `${this.repoApiPath()}/actions/workflows/${encodeURIComponent(String(wf.id))}/runs?per_page=1`,
        errors,
      );

      const jobs: Array<{ name: string; runsOn: string; steps: string[]; needs: string[] }> = [];

      if (runsResponse?.workflow_runs?.[0]) {
        // Fetch jobs for the most recent run
        const jobsResponse = await this.fetchSingle<{ total_count: number; jobs: GitHubJob[] }>(
          `${this.repoApiPath()}/actions/runs/${encodeURIComponent(String(runsResponse.workflow_runs[0].id))}/jobs`,
          errors,
        );

        if (jobsResponse?.jobs) {
          for (const job of jobsResponse.jobs) {
            jobs.push({
              name: job.name,
              runsOn: job.runner_name || 'unknown',
              steps: (job.steps || []).map((s) => s.name),
              needs: this.resolveJobNeeds(job.name, parsedDef),
            });
          }
        }
      }

      // Real triggers come from the workflow file's `on:` key; when the
      // file could not be fetched or parsed we honestly report 'unknown'.
      const trigger = parsedDef && parsedDef.triggers.length > 0 ? parsedDef.triggers.join(',') : 'unknown';

      collectedWorkflows.push({
        name: wf.name,
        trigger,
        jobs,
      });
    }

    return collectedWorkflows;
  }

  /**
   * Fetch a workflow YAML file via the contents API and parse its
   * `on:` triggers and per-job `needs:` declarations.
   *
   * @returns Parsed definition, or `null` when the file could not be
   * fetched (an error is recorded by {@link fetchSingle}).
   */
  private async fetchWorkflowDefinition(
    path: string,
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<ParsedWorkflowDef | null> {
    if (!path) return null;
    // Encode each path segment (but not the separators) so unusual
    // characters in the workflow path cannot break the API URL.
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const file = await this.fetchSingle<{ content?: string; encoding?: string }>(
      `${this.repoApiPath()}/contents/${encodedPath}`,
      errors,
    );
    if (!file || typeof file.content !== 'string') return null;
    try {
      const raw = file.encoding === 'base64' || file.encoding === undefined
        ? Buffer.from(file.content, 'base64').toString('utf8')
        : file.content;
      return this.parseWorkflowDefinition(raw);
    } catch (err) {
      errors.push({ message: `Failed to decode workflow file ${path}: ${err instanceof Error ? err.message : String(err)}` });
      return null;
    }
  }

  /**
   * Minimal, indentation-based parse of a GitHub Actions workflow file.
   * Extracts top-level `on:` trigger names and each job's `needs:` list.
   * Anything it cannot parse is simply omitted — never guessed.
   */
  private parseWorkflowDefinition(yaml: string): ParsedWorkflowDef {
    const lines = yaml.split(/\r?\n/);
    const triggers: string[] = [];
    const jobs: ParsedWorkflowDef['jobs'] = [];

    const indentOf = (line: string): number => line.length - line.trimStart().length;
    const unquote = (s: string): string => s.trim().replace(/^['"]|['"]$/g, '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (indentOf(line) !== 0) continue;

      // --- Top-level `on:` key ---
      const onMatch = trimmed.match(/^(?:"on"|'on'|on)\s*:\s*(.*)$/);
      if (onMatch) {
        const inline = (onMatch[1] ?? '').split('#')[0]!.trim();
        if (inline.startsWith('[')) {
          for (const part of inline.replace(/^\[/, '').replace(/\]$/, '').split(',')) {
            const name = unquote(part);
            if (name) triggers.push(name);
          }
        } else if (inline) {
          triggers.push(unquote(inline));
        } else {
          // Block form: trigger names are keys (or list items) below.
          let blockIndent = -1;
          for (let j = i + 1; j < lines.length; j++) {
            const l = lines[j]!;
            const t = l.trim();
            if (!t || t.startsWith('#')) continue;
            const ind = indentOf(l);
            if (ind === 0) break;
            if (t.startsWith('-')) {
              const name = unquote(t.replace(/^-\s*/, ''));
              if (name) triggers.push(name);
              continue;
            }
            if (blockIndent === -1) blockIndent = ind;
            if (ind === blockIndent && t.includes(':')) {
              const key = unquote(t.split(':')[0]!);
              if (key) triggers.push(key);
            }
          }
        }
        continue;
      }

      // --- Top-level `jobs:` key ---
      if (/^jobs\s*:\s*(#.*)?$/.test(trimmed)) {
        let jobIndent = -1;
        let current: { id: string; name: string | null; needs: string[] } | null = null;
        let bodyIndent = -1;
        let inNeedsList = false;

        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j]!;
          const t = l.trim();
          if (!t || t.startsWith('#')) continue;
          const ind = indentOf(l);
          if (ind === 0) break; // next top-level key ends the jobs block

          if (jobIndent === -1) jobIndent = ind;

          if (ind === jobIndent) {
            // New job id
            inNeedsList = false;
            bodyIndent = -1;
            const idMatch = t.match(/^([A-Za-z0-9_-]+)\s*:\s*(#.*)?$/);
            if (idMatch) {
              current = { id: idMatch[1]!, name: null, needs: [] };
              jobs.push(current);
            } else {
              current = null;
            }
            continue;
          }

          if (!current || ind <= jobIndent) continue;

          if (inNeedsList) {
            if (t.startsWith('-')) {
              const name = unquote(t.replace(/^-\s*/, ''));
              if (name) current.needs.push(name);
              continue;
            }
            inNeedsList = false;
          }

          if (bodyIndent === -1) bodyIndent = ind;
          if (ind !== bodyIndent) continue; // nested content (steps, with, etc.)

          const nameMatch = t.match(/^name\s*:\s*(.+)$/);
          if (nameMatch && current.name === null) {
            current.name = unquote(nameMatch[1]!.split('#')[0]!);
            continue;
          }

          const needsMatch = t.match(/^needs\s*:\s*(.*)$/);
          if (needsMatch) {
            const value = (needsMatch[1] ?? '').split('#')[0]!.trim();
            if (value.startsWith('[')) {
              for (const part of value.replace(/^\[/, '').replace(/\]$/, '').split(',')) {
                const name = unquote(part);
                if (name) current.needs.push(name);
              }
            } else if (value) {
              current.needs.push(unquote(value));
            } else {
              inNeedsList = true;
            }
          }
        }
      }
    }

    return { triggers, jobs };
  }

  /**
   * Resolve a run job's `needs:` dependencies (declared in the workflow
   * file by job id) to display names matching the runs API job names.
   * Returns an empty list when the job cannot be matched to a declared
   * job — dependencies are then omitted, not invented.
   */
  private resolveJobNeeds(runJobName: string, parsedDef: ParsedWorkflowDef | null): string[] {
    if (!parsedDef) return [];
    const displayNameById = new Map(parsedDef.jobs.map((j) => [j.id, j.name ?? j.id]));
    const yamlJob = parsedDef.jobs.find((j) => (j.name ?? j.id) === runJobName);
    if (!yamlJob) return [];
    return yamlJob.needs
      .map((id) => displayNameById.get(id))
      .filter((n): n is string => typeof n === 'string');
  }

  /**
   * Fetch deployments from the GitHub API.
   */
  private async fetchDeployments(
    errors: Array<{ message: string; details?: unknown }>,
  ): Promise<CollectedDeployment[]> {
    const rawDeployments = await this.fetchPaginated<GitHubDeployment>(
      `${this.repoApiPath()}/deployments`,
      errors,
      100,
    );

    const collected: CollectedDeployment[] = [];
    // Cap per-deployment status lookups to bound API usage; deployments
    // beyond the cap simply omit the status field.
    const STATUS_LOOKUP_LIMIT = 30;

    for (let i = 0; i < rawDeployments.length; i++) {
      const d = rawDeployments[i]!;
      let status: string | undefined;

      if (i < STATUS_LOOKUP_LIMIT) {
        // Deployment statuses are returned newest-first; take the latest.
        // Truncation notes are suppressed: fetching only the newest
        // status is intentional, not silent data loss.
        const statuses = await this.fetchPaginated<{ state: string }>(
          `${this.repoApiPath()}/deployments/${encodeURIComponent(String(d.id))}/statuses?per_page=1`,
          errors,
          1,
          { noteTruncation: false },
        );
        if (statuses[0] && typeof statuses[0].state === 'string') {
          status = statuses[0].state;
        }
      }

      collected.push({
        environment: d.environment || 'unknown',
        sha: d.sha?.substring(0, 7) || 'unknown',
        creator: d.creator?.login || 'unknown',
        // Real creation timestamp from the API, when present.
        ...(typeof d.created_at === 'string' && d.created_at ? { createdAt: d.created_at } : {}),
        // Only include status when the statuses API actually reported one.
        ...(status !== undefined ? { status } : {}),
      });
    }

    return collected;
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
   * - `deployment` entities for each deployment event
   *
   * @returns Array of entities.
   */
  private buildEntities(
    users: string[],
    teams: Array<{ name: string }>,
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
    // Team membership is never fetched (requires org admin), so members /
    // member_count are omitted entirely — an unfetched roster must not be
    // reported as an empty one.
    for (const team of teams) {
      entities.push(
        this.makeEntity('team', team.name, {
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

    // --- Deployment entities ---
    // Names include the sha so multiple deployments to the same
    // environment do not collide into one entity.
    for (const deploy of deployments) {
      entities.push(
        this.makeEntity('deployment', `deploy-${deploy.environment}-${deploy.sha}`, {
          environment: deploy.environment,
          sha: deploy.sha,
          creator: deploy.creator,
          // Real creation timestamp from the API, only when reported.
          ...(deploy.createdAt !== undefined ? { created_at: deploy.createdAt } : {}),
          // Status is only present when the deployment statuses API
          // actually reported one — never defaulted.
          ...(deploy.status !== undefined ? { status: deploy.status } : {}),
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
   * - `depends_on` — job → job, from declared `needs:` in the workflow file
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

    // User reviews (reviewer → author). Reviewers come from actually
    // submitted reviews (/pulls/{n}/reviews), never from review requests.
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

    // Job → Job (depends_on) — only from `needs:` declared in the
    // workflow file. Jobs without declared dependencies get none.
    for (const wf of workflows) {
      for (const job of wf.jobs) {
        if (job.needs.length === 0) continue;
        const jobEntity = jobs.find((j) => j.name === `${wf.name}.${job.name}`);
        if (!jobEntity) continue;
        for (const neededName of job.needs) {
          const target = jobs.find((j) => j.name === `${wf.name}.${neededName}`);
          if (target) {
            relationships.push(this.makeRel('depends_on', jobEntity.id, target.id, {
              declared_via: 'needs',
            }));
          }
        }
      }
    }

    return relationships;
  }
}
