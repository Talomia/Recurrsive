/**
 * @module @recurrsive/collectors/error-tracking/collector
 *
 * Error Tracking Collector — ingests error events, error groups,
 * alert rules, services, environments, and users from the Sentry API
 * and produces entities and relationships for the knowledge graph.
 *
 * Requires Sentry credentials (auth token, org slug, project slug).
 * If no credentials are configured, returns empty results.
 *
 * Produces entities:
 * - `incident` — individual error occurrences (error events)
 * - `alert` — grouped/deduplicated error patterns (error groups)
 * - `config` — alerting rules
 * - `infrastructure_resource` — services experiencing errors
 * - `user` — issue assignees and alert rule owners
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

const logger = createLogger({ context: { module: 'error-tracking-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Supported error tracking platforms. */
export type ErrorTrackingPlatform = 'sentry' | 'bugsnag' | 'rollbar';

/** Sentry issue from the API. */
interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  type: string;
  metadata: { type?: string; value?: string };
  count: string;
  firstSeen: string;
  lastSeen: string;
  level: 'fatal' | 'error' | 'warning' | 'info';
  assignedTo?: { name: string; type: string } | null;
  project?: { slug: string; name: string };
}

/** Sentry alert rule from the API. */
interface SentryAlertRule {
  id: string;
  name: string;
  conditions: Array<{ id: string; name?: string }>;
  actions: Array<{ id: string; name?: string }>;
  owner?: string;
  dateCreated: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// ErrorTrackingCollector
// ---------------------------------------------------------------------------

/**
 * Collects error events, error groups, alert rules, services,
 * environments, and users from the Sentry API.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and DSN.
 * 2. {@link validate} — verify the DSN is well-formed.
 * 3. {@link collect} — fetch issues from Sentry and build entities &
 *    relationships.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new ErrorTrackingCollector('sentry');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { sentry_auth_token: 'sntrys_...', sentry_org: 'my-org', sentry_project: 'my-project' },
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class ErrorTrackingCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'error-tracking';
  /** @inheritdoc */
  readonly name = 'Error Tracking Collector';
  /** @inheritdoc */
  readonly description = 'Collects error events, error groups, alert rules, and services from error tracking platforms';
  /** @inheritdoc */
  readonly type: CollectorType = 'observability';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Error tracking platform. */
  private platform: ErrorTrackingPlatform;
  /** Data source name / project URL. */
  private dsn: string;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;
  /** Stored collector configuration. */
  private config!: CollectorConfig;

  /**
   * @param platform - Error tracking platform (default: `'sentry'`).
   */
  constructor(platform: ErrorTrackingPlatform = 'sentry') {
    this.platform = platform;
    this.dsn = '';
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
    this.config = config;
    this.governanceFilter = new GovernanceFilter(config.governance);

    if (typeof config.custom['dsn'] === 'string') {
      this.dsn = config.custom['dsn'];
    }

    if (typeof config.custom['platform'] === 'string') {
      const p = config.custom['platform'];
      if (p === 'sentry' || p === 'bugsnag' || p === 'rollbar') {
        this.platform = p;
      }
    }

    this.initialized = true;
    logger.info('ErrorTrackingCollector initialized', {
      platform: this.platform,
      dsn: this.dsn,
    });
  }

  /**
   * Validate that the configured DSN / platform is well-formed.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const validPlatforms: ErrorTrackingPlatform[] = ['sentry', 'bugsnag', 'rollbar'];
    if (!validPlatforms.includes(this.platform)) {
      errors.push(`'${this.platform}' is not a supported platform. Supported: ${validPlatforms.join(', ')}`);
    }

    if (this.dsn) {
      try {
        new URL(this.dsn);
      } catch {
        errors.push(`'${this.dsn}' is not a valid DSN URL`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the full collection run.
   *
   * Fetches issues from the Sentry API. If no credentials are configured,
   * returns empty results with a warning.
   *
   * @returns Entities, relationships, and run metadata.
   * @throws {CollectorError} If the collector has not been initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'ErrorTrackingCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // Check for Sentry credentials
    const authToken = (this.config.custom['sentry_auth_token'] as string) ||
      process.env['SENTRY_AUTH_TOKEN'];
    const org = (this.config.custom['sentry_org'] as string) ||
      process.env['SENTRY_ORG'];
    const project = (this.config.custom['sentry_project'] as string) ||
      process.env['SENTRY_PROJECT'];

    if (!authToken || !org || !project) {
      const durationMs = Date.now() - startTime;
      logger.warn('No Sentry credentials configured, skipping collection', {
        hasToken: !!authToken,
        hasOrg: !!org,
        hasProject: !!project,
      });
      errors.push({
        message:
          'No Sentry credentials configured (need sentry_auth_token, sentry_org, and sentry_project); skipping collection',
        details: { hasToken: !!authToken, hasOrg: !!org, hasProject: !!project },
      });
      return {
        entities: [],
        relationships: [],
        metadata: {
          collector_id: this.id,
          collected_at: nowISO(),
          duration_ms: durationMs,
          items_processed: 0,
          errors,
        },
      };
    }

    const baseUrl = (this.config.custom['sentry_url'] as string) ||
      process.env['SENTRY_URL'] ||
      'https://sentry.io';

    // Fetch issues from Sentry (paginated via Link/cursor headers, bounded)
    const maxIssues = 500;
    let issues: SentryIssue[] = [];
    let rules: SentryAlertRule[] = [];

    try {
      let issuesUrl: string | null =
        `${baseUrl}/api/0/projects/${org}/${project}/issues/?query=is:unresolved`;

      while (issuesUrl && issues.length < maxIssues) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const issuesResponse = await fetch(issuesUrl, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!issuesResponse.ok) {
          throw new Error(`Sentry API returned ${issuesResponse.status}: ${issuesResponse.statusText}`);
        }

        const page = (await issuesResponse.json()) as SentryIssue[];
        issues.push(...(Array.isArray(page) ? page : []));

        issuesUrl = this.parseSentryNextLink(issuesResponse.headers.get('Link'));

        if (issuesUrl && issues.length >= maxIssues) {
          const msg = `Sentry issues truncated at ${maxIssues}; more pages were available but not fetched`;
          logger.warn(msg);
          errors.push({ message: msg });
        }
      }

      if (issues.length > maxIssues) {
        issues = issues.slice(0, maxIssues);
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logger.warn('Failed to fetch Sentry issues', { error: err });
      return {
        entities: [],
        relationships: [],
        metadata: {
          collector_id: this.id,
          collected_at: nowISO(),
          duration_ms: durationMs,
          items_processed: 0,
          errors: [{ message: `Sentry issues fetch failed: ${err instanceof Error ? err.message : String(err)}` }],
        },
      };
    }

    // Fetch alert rules
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const rulesResponse = await fetch(
        `${baseUrl}/api/0/projects/${org}/${project}/rules/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (rulesResponse.ok) {
        rules = (await rulesResponse.json()) as SentryAlertRule[];
      } else {
        const msg = `Sentry alert rules fetch failed: ${rulesResponse.status} ${rulesResponse.statusText}; continuing without alert rules`;
        logger.warn(msg);
        errors.push({ message: msg, details: { status: rulesResponse.status } });
      }
    } catch (err) {
      // Alert rules are optional — continue without them, but record the failure
      const msg = `Sentry alert rules fetch failed: ${err instanceof Error ? err.message : String(err)}; continuing without alert rules`;
      logger.warn(msg);
      errors.push({ message: msg });
    }

    // Build entities and relationships
    const entities = this.buildEntities(issues, rules);
    const relationships = this.buildRelationships(entities);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    logger.info('ErrorTrackingCollector collection complete', {
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
        items_processed: issues.length + rules.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('ErrorTrackingCollector disposed', { platform: this.platform });
  }

  // -----------------------------------------------------------------------
  // Internal: Pagination Helpers
  // -----------------------------------------------------------------------

  /**
   * Parse a Sentry `Link` header and return the URL of the next page,
   * or `null` when there are no further results.
   *
   * Sentry link headers look like:
   * `<url>; rel="previous"; results="false"; cursor="...", <url>; rel="next"; results="true"; cursor="..."`
   */
  private parseSentryNextLink(header: string | null): string | null {
    if (!header) return null;
    for (const part of header.split(',')) {
      if (part.includes('rel="next"')) {
        if (part.includes('results="false"')) return null;
        const match = part.match(/<([^>]+)>/);
        return match ? match[1]! : null;
      }
    }
    return null;
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
      qualified_name: qualifiedName(this.platform, name),
      source: this.id,
      properties: props,
      tags: ['error-tracking', this.platform, ...tags],
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

  // -----------------------------------------------------------------------
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from Sentry API data.
   *
   * Creates:
   * - `incident` entities for each Sentry issue
   * - `alert` entities for groups of similar error types
   * - `config` entities for each alert rule
   * - `infrastructure_resource` entities for unique services (culprits)
   * - `user` entities for unique issue assignees and rule owners
   *
   * @param issues - Sentry issues from the API.
   * @param rules - Sentry alert rules from the API.
   * @returns Array of entities.
   */
  private buildEntities(issues: SentryIssue[], rules: SentryAlertRule[]): Entity[] {
    const entities: Entity[] = [];

    // --- Incident entities (each issue) ---
    for (const issue of issues) {
      entities.push(
        this.makeEntity('incident', issue.title, {
          sentry_id: issue.id,
          error_type: issue.type,
          severity: issue.level,
          culprit: issue.culprit,
          occurrences: parseInt(issue.count, 10) || 0,
          first_seen: issue.firstSeen,
          last_seen: issue.lastSeen,
          platform: this.platform,
        }, ['error-event', issue.level, issue.type.toLowerCase()]),
      );
    }

    // --- Alert (error group) entities by type ---
    const issuesByType = new Map<string, SentryIssue[]>();
    for (const issue of issues) {
      const type = issue.type || 'unknown';
      if (!issuesByType.has(type)) issuesByType.set(type, []);
      issuesByType.get(type)!.push(issue);
    }
    for (const [type, typeIssues] of issuesByType) {
      const totalCount = typeIssues.reduce((sum, i) => sum + (parseInt(i.count, 10) || 0), 0);
      entities.push(
        this.makeEntity('alert', `${type} Errors`, {
          pattern: type,
          error_types: [type],
          count: totalCount,
          first_seen: typeIssues[0]?.firstSeen ?? '',
          last_seen: typeIssues[typeIssues.length - 1]?.lastSeen ?? '',
          platform: this.platform,
        }, ['error-group']),
      );
    }

    // --- Config entities (alert rules) ---
    for (const rule of rules) {
      entities.push(
        this.makeEntity('config', rule.name, {
          sentry_rule_id: rule.id,
          condition: rule.conditions.map((c) => c.name || c.id).join(', '),
          threshold: 0,
          owner: rule.owner ?? 'unassigned',
          channel: rule.actions.map((a) => a.name || a.id).join(', '),
          enabled: rule.status !== 'disabled',
          platform: this.platform,
        }, ['alert-rule', rule.status !== 'disabled' ? 'enabled' : 'disabled']),
      );
    }

    // --- Infrastructure resource entities (unique culprits/services) ---
    const uniqueCulprits = new Set(issues.map((i) => i.culprit).filter(Boolean));
    for (const culprit of uniqueCulprits) {
      const culpritIssues = issues.filter((i) => i.culprit === culprit);
      const totalOccurrences = culpritIssues.reduce((sum, i) => sum + (parseInt(i.count, 10) || 0), 0);
      entities.push(
        this.makeEntity('infrastructure_resource', culprit, {
          language: 'unknown',
          framework: 'unknown',
          error_rate: totalOccurrences,
          issue_count: culpritIssues.length,
          platform: this.platform,
        }, ['service']),
      );
    }

    // --- User entities (unique assignees + rule owners) ---
    const uniqueUsers = new Set<string>();
    for (const issue of issues) {
      if (issue.assignedTo?.name) uniqueUsers.add(issue.assignedTo.name);
    }
    for (const rule of rules) {
      if (rule.owner) uniqueUsers.add(rule.owner);
    }
    for (const username of uniqueUsers) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          platform: this.platform,
        }),
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
   * - `monitors` — config (alert rule) monitors alert (error group), only
   *   when the rule's conditions actually reference the group's error type
   * - `contains` — infrastructure_resource contains incidents
   * - `owns` — user owns config (alert rule)
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const incidents = entities.filter((e) => e.type === 'incident');
    const alertGroups = entities.filter((e) => e.type === 'alert');
    const alertRules = entities.filter((e) => e.type === 'config');
    const services = entities.filter((e) => e.type === 'infrastructure_resource');

    // Config (alert rule) → Alert (error group) (monitors) — only when the
    // rule's conditions reference the group's error type. Sentry rule
    // conditions rarely name error types, so this is intentionally sparse
    // rather than a fabricated every-rule × every-group cross-product.
    for (const rule of alertRules) {
      const condition = String(rule.properties['condition'] ?? '').toLowerCase();
      if (!condition) continue;
      for (const group of alertGroups) {
        const pattern = String(group.properties['pattern'] ?? '').toLowerCase();
        if (pattern && condition.includes(pattern)) {
          relationships.push(this.makeRel('monitors', rule.id, group.id, {
            rule_name: rule.name,
            group_name: group.name,
          }));
        }
      }
    }

    // Infrastructure Resource → Incident (contains)
    for (const svc of services) {
      const svcIncidents = incidents.filter(
        (i) => i.properties['culprit'] === svc.name,
      );
      for (const incident of svcIncidents) {
        relationships.push(this.makeRel('contains', svc.id, incident.id, {
          service: svc.name,
        }));
      }
    }

    // User → Config (owns)
    for (const rule of alertRules) {
      const ownerName = rule.properties['owner'] as string;
      const ownerEntity = users.find((u) => u.name === ownerName);
      if (ownerEntity) {
        relationships.push(this.makeRel('owns', ownerEntity.id, rule.id, {
          rule_name: rule.name,
        }));
      }
    }

    return relationships;
  }
}
