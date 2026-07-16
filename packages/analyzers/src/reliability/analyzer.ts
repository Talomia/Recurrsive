/**
 * @module @recurrsive/analyzers/reliability
 *
 * Reliability analyzer that detects resilience gaps such as single
 * points of failure, missing retries, missing timeouts, error
 * swallowing, and lack of circuit breakers.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/**
 * Analyzes the knowledge graph for reliability and resilience issues.
 *
 * ### Rules
 * 1. Single point of failure — critical infra/deployment resources with no
 *    redundancy (evaluated only when such entities and their dependents exist)
 * 2. Missing health checks — services without health check endpoints
 * 3. No graceful shutdown — missing shutdown handlers
 *
 * ### Removed rules (producer/consumer contract mismatch)
 * "Missing retries", "Missing timeouts", and "No circuit breaker" each required
 * a function to have an external-call relationship (`uses_model`,
 * `queries_table`, `reads_from`, `writes_to`, `routes_to`) attached to the
 * function entity. Those relationships are never produced against `function`
 * entities (`queries_table`/`reads_from`/`writes_to` are not produced at all),
 * so the rules' preconditions never held and they could never fire.
 * "Error swallowing" gated solely on `has_empty_catch`/`swallows_errors`
 * markers and `empty-catch`/`error-swallowed` tags that no parser emits, so it
 * was permanently dead. Health-check and graceful-shutdown detection are kept
 * because they fall back to name/path heuristics over produced endpoint and
 * function entities.
 */
export class ReliabilityAnalyzer implements Analyzer {
  readonly id = 'reliability.resilience';
  readonly name = 'Reliability Analyzer';
  readonly description =
    'Detects reliability gaps including missing retries, timeouts, circuit breakers, and error swallowing.';
  readonly version = '0.1.0';
  readonly categories = ['reliability' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [spof, healthChecks, shutdown] = await Promise.all([
      this.detectSinglePointOfFailure(ctx),
      this.detectMissingHealthChecks(ctx),
      this.detectNoGracefulShutdown(ctx),
    ]);

    findings.push(...spof, ...healthChecks, ...shutdown);

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // ── Cross-cutting: dependencies without resilience config ────
    const [dependencies, configs] = await Promise.all([
      ctx.graph.getEntities('dependency'),
      ctx.graph.getEntities('config'),
    ]);

    if (dependencies.length > 0) {
      const resiliencePatterns = ['retry', 'circuit-breaker', 'circuit_breaker', 'timeout', 'bulkhead', 'rate-limit', 'fallback'];

      const hasResilienceConfig = configs.some((c) =>
        resiliencePatterns.some(
          (pattern) =>
            c.tags.includes(pattern) ||
            c.name.toLowerCase().includes(pattern) ||
            c.properties['pattern'] === pattern,
        ),
      );

      if (!hasResilienceConfig) {
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: 'External dependencies without resilience configuration',
            description: `Project declares ${dependencies.length} external dependencies but no configuration entities implement resilience patterns (retry, circuit-breaker, timeout, bulkhead). Any transient failure in external services will propagate directly to callers without mitigation.`,
            severity: 'high',
            category: 'reliability',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `${dependencies.length} dependencies, 0 resilience configs among ${configs.length} config entities`,
                entity_ids: [
                  ...dependencies.slice(0, 10).map((d) => d.id),
                  ...configs.slice(0, 5).map((c) => c.id),
                ],
                confidence: 0.8,
                data: {
                  dependency_count: dependencies.length,
                  config_count: configs.length,
                  resilience_config_found: false,
                  checked_patterns: resiliencePatterns,
                },
              }),
            ],
            locations: [],
            suggested_fix:
              'Add resilience configuration for external dependencies: retry policies with exponential backoff, circuit breakers for degraded services, timeouts for all network calls, and bulkheads to isolate failure domains. Use libraries like opossum, p-retry, or cockatiel.',
            confidence: 0.75,
            tags: ['resilience', 'reliability', 'cross-cutting', 'dependencies'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 1: Single Point of Failure ────────────────────────────────

  /**
   * Detect critical-path entities that have no redundancy — single
   * instances of databases, caches, or external services that the
   * entire system depends on.
   *
   * @param ctx - Analysis context.
   * @returns Findings for single points of failure.
   */
  private async detectSinglePointOfFailure(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const infraResources = await ctx.graph.getEntities('infrastructure_resource');
    const deployments = await ctx.graph.getEntities('deployment');
    const allResources = [...infraResources, ...deployments];

    for (const resource of allResources) {
      const inRels = await ctx.graph.getRelationships(resource.id, 'in');
      const dependents = inRels.filter(
        (r) => r.type === 'depends_on' || r.type === 'routes_to' || r.type === 'reads_from',
      );

      // A SPOF has multiple dependents but no redundancy markers
      if (dependents.length < 3) continue;

      const hasRedundancy =
        resource.properties['replicas'] != null &&
        (resource.properties['replicas'] as number) > 1;
      const hasFailover =
        resource.tags.includes('ha') ||
        resource.tags.includes('high-availability') ||
        resource.tags.includes('replicated') ||
        resource.tags.includes('clustered') ||
        resource.properties['failover'] === true;

      if (!hasRedundancy && !hasFailover) {
        const loc = locationFromEntity(resource);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Single point of failure: ${resource.name}`,
            description: `'${resource.name}' has ${dependents.length} dependents but no redundancy or failover configuration. If this component fails, ${dependents.length} services will be affected.`,
            severity: 'critical',
            category: 'reliability',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `${dependents.length} dependents, no redundancy`,
                entity_ids: [resource.id, ...dependents.map((d) => d.source_id)],
                confidence: 0.85,
                data: {
                  dependent_count: dependents.length,
                  has_redundancy: hasRedundancy,
                  has_failover: hasFailover,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add redundancy through replication, clustering, or multi-AZ deployment. Configure automatic failover and health-based routing.',
            confidence: 0.8,
            tags: ['spof', 'reliability', 'redundancy'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: Missing Health Checks ──────────────────────────────────

  /**
   * Detect services without health check endpoints.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing health checks.
   */
  private async detectMissingHealthChecks(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');
    const deployments = await ctx.graph.getEntities('deployment');

    // Check if any health check endpoint exists
    const hasHealthEndpoint = endpoints.some(
      (e) =>
        e.name.toLowerCase().includes('health') ||
        e.name.toLowerCase().includes('readiness') ||
        e.name.toLowerCase().includes('liveness') ||
        e.tags.includes('health-check') ||
        ((e.properties['path'] as string | undefined) ?? '').includes('/health'),
    );

    // Only flag if we have deployments or multiple endpoints (suggesting a service)
    if (endpoints.length > 2 && !hasHealthEndpoint) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Missing health check endpoint',
          description: `The service defines ${endpoints.length} endpoints but no health check endpoint (/health, /readiness, /liveness). Health checks are essential for load balancer routing, orchestrator restarts, and monitoring.`,
          severity: 'medium',
          category: 'reliability',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `${endpoints.length} endpoints, no health check`,
              entity_ids: endpoints.map((e) => e.id),
              confidence: 0.8,
            }),
          ],
          locations: [],
          suggested_fix:
            'Add /health (liveness) and /ready (readiness) endpoints. The health endpoint should check the service process is alive; the readiness endpoint should verify dependencies (DB, cache) are reachable.',
          confidence: 0.75,
          tags: ['health-check', 'reliability', 'observability'],
        }),
      );
    }

    // Also check deployments for health check configuration
    for (const deployment of deployments) {
      const hasHealthConfig =
        deployment.properties['health_check'] != null ||
        deployment.properties['liveness_probe'] != null ||
        deployment.properties['readiness_probe'] != null ||
        deployment.tags.includes('health-configured');

      if (!hasHealthConfig) {
        const loc = locationFromEntity(deployment);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Deployment without health check: ${deployment.name}`,
            description: `Deployment '${deployment.name}' has no health check configuration. The orchestrator cannot detect and restart unhealthy instances.`,
            severity: 'high',
            category: 'reliability',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Deployment without health check probes',
                entity_ids: [deployment.id],
                confidence: 0.85,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Configure liveness and readiness probes in your deployment spec (e.g., Kubernetes livenessProbe/readinessProbe).',
            confidence: 0.8,
            tags: ['health-check', 'reliability', 'deployment'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: No Graceful Shutdown ───────────────────────────────────

  /**
   * Detect services without graceful shutdown handlers.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing shutdown handlers.
   */
  private async detectNoGracefulShutdown(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    const endpoints = await ctx.graph.getEntities('endpoint');

    // Only check if we have a service (endpoints suggest a running server)
    if (endpoints.length === 0) return findings;

    const hasShutdownHandler = functions.some(
      (fn) =>
        fn.name.toLowerCase().includes('shutdown') ||
        fn.name.toLowerCase().includes('cleanup') ||
        fn.name.toLowerCase().includes('graceful') ||
        fn.name.toLowerCase().includes('sigterm') ||
        fn.name.toLowerCase().includes('sigint') ||
        fn.tags.includes('shutdown-handler') ||
        fn.tags.includes('signal-handler') ||
        fn.properties['handles_signal'] === true,
    );

    if (!hasShutdownHandler) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No graceful shutdown handler',
          description:
            'No SIGTERM/SIGINT signal handler or graceful shutdown function detected. Without graceful shutdown, in-flight requests will be dropped during deployments or scaling events, causing errors for active users.',
          severity: 'medium',
          category: 'reliability',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: 'No shutdown handler found among service functions',
              entity_ids: endpoints.slice(0, 5).map((e) => e.id),
              confidence: 0.7,
            }),
          ],
          locations: [],
          suggested_fix:
            'Add a SIGTERM handler that: 1) stops accepting new connections, 2) waits for in-flight requests to complete, 3) closes database/cache connections, 4) exits with code 0.',
          confidence: 0.7,
          tags: ['graceful-shutdown', 'reliability', 'deployment'],
        }),
      );
    }

    return findings;
  }
}
