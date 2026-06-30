/**
 * @module @recurrsive/collectors/cicd/collector
 *
 * CI/CD Collector — discovers and parses GitHub Actions workflows,
 * GitLab CI pipelines, and other CI/CD configuration files to build
 * pipeline topology entities and relationships.
 *
 * Produces entities:
 * - `pipeline` — CI/CD pipeline definitions
 * - `job` — individual jobs within pipelines
 * - `step` — steps within jobs
 * - `workflow` — GitHub Actions workflow definitions
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

const logger = createLogger({ context: { module: 'cicd-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface WorkflowInfo {
  name: string;
  path: string;
  triggers: string[];
  jobs: JobInfo[];
  env: string[];
}

interface JobInfo {
  name: string;
  runsOn: string;
  steps: StepInfo[];
  needs: string[];
}

interface StepInfo {
  name: string;
  uses?: string;
  run?: string;
}

// ---------------------------------------------------------------------------
// GitHub Actions Parser
// ---------------------------------------------------------------------------

/**
 * Parse a GitHub Actions workflow YAML file.
 * Simple line-based parser for common patterns.
 */
function parseGitHubWorkflow(content: string, filePath: string): WorkflowInfo {
  const lines = content.split('\n');
  let workflowName = path.basename(filePath, path.extname(filePath));
  const triggers: string[] = [];
  const jobs: JobInfo[] = [];
  const env: string[] = [];

  let section = '';
  let currentJob: JobInfo | null = null;
  let currentStep: StepInfo | null = null;
  let inOn = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // Top-level keys
    if (indent === 0) {
      if (trimmed.startsWith('name:')) {
        workflowName = trimmed.slice(5).trim().replace(/^['"]|['"]$/g, '');
      } else if (trimmed === 'on:' || trimmed.startsWith('on:')) {
        inOn = true;
        section = 'on';
        // Inline triggers like `on: push`
        const inlineVal = trimmed.slice(3).trim();
        if (inlineVal && inlineVal !== '') {
          triggers.push(inlineVal);
          inOn = false;
        }
      } else if (trimmed === 'jobs:') {
        inOn = false;
        section = 'jobs';
        if (currentStep) {
          currentJob?.steps.push(currentStep);
          currentStep = null;
        }
        if (currentJob) {
          jobs.push(currentJob);
          currentJob = null;
        }
      } else if (trimmed === 'env:') {
        inOn = false;
        section = 'env';
      } else {
        inOn = false;
        section = '';
      }
      continue;
    }

    // On section — gather triggers
    if (inOn && indent === 2 && !trimmed.startsWith('-')) {
      const trigger = trimmed.replace(':', '').trim();
      if (trigger) triggers.push(trigger);
      continue;
    }

    if (inOn && indent === 2 && trimmed.startsWith('-')) {
      triggers.push(trimmed.slice(1).trim());
      continue;
    }

    // Env section
    if (section === 'env' && indent === 2) {
      const key = trimmed.split(':')[0]?.trim();
      if (key) env.push(key);
      continue;
    }

    // Jobs section
    if (section === 'jobs') {
      // Job definition (indent 2, ends with colon)
      if (indent === 2 && trimmed.endsWith(':') && !trimmed.startsWith('-')) {
        if (currentStep) {
          currentJob?.steps.push(currentStep);
          currentStep = null;
        }
        if (currentJob) jobs.push(currentJob);
        currentJob = {
          name: trimmed.slice(0, -1),
          runsOn: '',
          steps: [],
          needs: [],
        };
        continue;
      }

      if (!currentJob) continue;

      // Job properties (indent 4)
      if (indent === 4) {
        if (trimmed.startsWith('runs-on:')) {
          currentJob.runsOn = trimmed.slice(8).trim().replace(/^['"]|['"]$/g, '');
        } else if (trimmed.startsWith('name:')) {
          currentJob.name = trimmed.slice(5).trim().replace(/^['"]|['"]$/g, '');
        } else if (trimmed.startsWith('needs:')) {
          const val = trimmed.slice(6).trim();
          if (val.startsWith('[')) {
            // Inline array
            currentJob.needs = val
              .replace(/[\[\]]/g, '')
              .split(',')
              .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
              .filter(Boolean);
          } else if (val) {
            currentJob.needs = [val.replace(/^['"]|['"]$/g, '')];
          }
        }
        continue;
      }

      // Steps (indent 6+)
      if (indent === 6 && trimmed.startsWith('- ')) {
        if (currentStep) {
          currentJob.steps.push(currentStep);
        }
        currentStep = { name: '' };

        if (trimmed.startsWith('- name:')) {
          currentStep.name = trimmed.slice(7).trim().replace(/^['"]|['"]$/g, '');
        } else if (trimmed.startsWith('- uses:')) {
          currentStep.uses = trimmed.slice(7).trim();
        } else if (trimmed.startsWith('- run:')) {
          currentStep.run = trimmed.slice(6).trim();
        }
        continue;
      }

      if (indent === 8 && currentStep) {
        if (trimmed.startsWith('name:')) {
          currentStep.name = trimmed.slice(5).trim().replace(/^['"]|['"]$/g, '');
        } else if (trimmed.startsWith('uses:')) {
          currentStep.uses = trimmed.slice(5).trim();
        } else if (trimmed.startsWith('run:')) {
          currentStep.run = trimmed.slice(4).trim();
        }
        continue;
      }

      // Needs array items (indent 6)
      if (indent === 6 && trimmed.startsWith('- ') && !currentStep) {
        currentJob.needs.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      }
    }
  }

  // Flush remaining
  if (currentStep) {
    currentJob?.steps.push(currentStep);
  }
  if (currentJob) {
    jobs.push(currentJob);
  }

  return { name: workflowName, path: filePath, triggers, jobs, env };
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export class CICDCollector implements Collector {
  readonly id = 'cicd';
  readonly name = 'CI/CD Collector';
  readonly description = 'Collects GitHub Actions, GitLab CI, and other CI/CD pipeline definitions.';
  readonly type: CollectorType = 'code';
  readonly version = '0.1.0';

  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async initialize(_config: CollectorConfig): Promise<void> {
    logger.info('CI/CD collector initialized', { rootPath: this.rootPath });
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
      tags: ['cicd', ...tags],
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

  async collect(): Promise<CollectorResult> {
    const startTime = Date.now();
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    // ── Discover GitHub Actions workflows ──────────────────────────
    const workflows = await this.findGitHubWorkflows();
    for (const wf of workflows) {
      const parsed = parseGitHubWorkflow(wf.content, wf.path);

      const workflowEntity = this.makeEntity(
        'workflow',
        `gha.${parsed.name}`,
        {
          source: 'github-actions',
          triggers: parsed.triggers,
          job_count: parsed.jobs.length,
          env_vars: parsed.env,
          absolute_path: wf.path,
        },
        ['github-actions', ...parsed.triggers],
      );
      entities.push(workflowEntity);

      // Create entities for each job
      const jobMap = new Map<string, Entity>();
      for (const job of parsed.jobs) {
        const jobEntity = this.makeEntity(
          'job',
          `gha.${parsed.name}.${job.name}`,
          {
            source: 'github-actions',
            runs_on: job.runsOn,
            step_count: job.steps.length,
            needs: job.needs,
            uses_actions: job.steps
              .filter((s) => s.uses)
              .map((s) => s.uses!),
          },
          ['github-actions'],
        );
        entities.push(jobEntity);
        jobMap.set(job.name, jobEntity);

        // Workflow → job
        relationships.push(this.makeRel('contains', workflowEntity.id, jobEntity.id));

        // Create step entities for significant steps
        for (const step of job.steps) {
          if (!step.name && !step.uses) continue;

          const stepEntity = this.makeEntity(
            'step',
            `gha.${parsed.name}.${job.name}.${step.name || step.uses || 'unnamed'}`,
            {
              source: 'github-actions',
              uses: step.uses ?? null,
              has_run_command: !!step.run,
            },
            step.uses ? ['github-actions', step.uses.split('@')[0]!] : ['github-actions'],
          );
          entities.push(stepEntity);

          // Job → step
          relationships.push(this.makeRel('contains', jobEntity.id, stepEntity.id));
        }
      }

      // Resolve job dependency relationships (needs)
      for (const job of parsed.jobs) {
        const jobEntity = jobMap.get(job.name);
        if (!jobEntity) continue;

        for (const need of job.needs) {
          const depEntity = jobMap.get(need);
          if (depEntity) {
            relationships.push(this.makeRel('depends_on', jobEntity.id, depEntity.id));
          }
        }
      }
    }

    // ── Discover GitLab CI ──────────────────────────────────────────
    const gitlabCI = await this.findGitLabCI();
    if (gitlabCI) {
      const pipelineEntity = this.makeEntity(
        'pipeline',
        'gitlab-ci',
        {
          source: 'gitlab-ci',
          absolute_path: gitlabCI.path,
          has_includes: gitlabCI.content.includes('include:'),
          has_stages: gitlabCI.content.includes('stages:'),
        },
        ['gitlab-ci'],
      );
      entities.push(pipelineEntity);
    }

    const durationMs = Date.now() - startTime;

    logger.info('CI/CD collection complete', {
      entities: entities.length,
      relationships: relationships.length,
      workflows: workflows.length,
      durationMs,
    });

    return {
      entities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: workflows.length + (gitlabCI ? 1 : 0),
        errors: [],
      },
    };
  }

  async dispose(): Promise<void> {
    // No resources to release
  }

  // ── File discovery helpers ─────────────────────────────────────

  private async findGitHubWorkflows(): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    const workflowDir = path.join(this.rootPath, '.github', 'workflows');

    try {
      const stat = await fs.stat(workflowDir);
      if (!stat.isDirectory()) return results;

      const entries = await fs.readdir(workflowDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.yml') && !entry.name.endsWith('.yaml')) continue;

        const filePath = path.join(workflowDir, entry.name);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          results.push({ path: filePath, content });
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // No .github/workflows directory
    }

    return results;
  }

  private async findGitLabCI(): Promise<{ path: string; content: string } | null> {
    const filePath = path.join(this.rootPath, '.gitlab-ci.yml');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { path: filePath, content };
    } catch {
      return null;
    }
  }
}
