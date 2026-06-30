/**
 * @module @recurrsive/analyzers/product
 *
 * Product analyzer — examines the knowledge graph for product-health
 * issues such as dead feature flags, missing analytics tracking,
 * absent A/B testing infrastructure, missing onboarding flows, and
 * lack of user feedback mechanisms.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
  Entity,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

// ─── Analyzer ─────────────────────────────────────────────────────────────────

/**
 * Analyzes the knowledge graph for product-health and feature-management
 * gaps.
 *
 * ### Rules
 * 1. **Dead feature flags** — flags that are always on/off or unused.
 * 2. **Missing analytics tracking** — key user actions without tracking.
 * 3. **No A/B testing infrastructure** — no experimentation framework.
 * 4. **Missing onboarding flows** — no guided first-run experience.
 * 5. **No feedback mechanism** — no way for users to provide feedback.
 *
 * @example
 * ```ts
 * const analyzer = new ProductAnalyzer();
 * await analyzer.initialize(ctx);
 * const findings = await analyzer.analyze(ctx);
 * ```
 */
export class ProductAnalyzer implements Analyzer {
  readonly id = 'product.health';
  readonly name = 'Product Analyzer';
  readonly description =
    'Detects product health issues: dead feature flags, missing analytics, no A/B testing, missing onboarding, and no feedback mechanism.';
  readonly version = '0.1.0';
  readonly categories = ['product' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      deadFlags,
      missingAnalytics,
      missingABTesting,
      missingOnboarding,
      missingFeedback,
    ] = await Promise.all([
      this.detectDeadFeatureFlags(ctx),
      this.detectMissingAnalytics(ctx),
      this.detectMissingABTesting(ctx),
      this.detectMissingOnboarding(ctx),
      this.detectMissingFeedback(ctx),
    ]);

    findings.push(
      ...deadFlags,
      ...missingAnalytics,
      ...missingABTesting,
      ...missingOnboarding,
      ...missingFeedback,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const endpoints = await ctx.graph.getEntities('endpoint');

      if (endpoints.length > 0) {
        // Cross-cutting check: no test coverage for API endpoints
        // Look for test files and test-tagged functions since 'test' is not a top-level entity type
        const files = await ctx.graph.getEntities('file');
        const functions = await ctx.graph.getEntities('function');

        const testFiles = files.filter(
          (f) =>
            /\.(test|spec)\./i.test(f.name) ||
            f.tags.includes('test') ||
            f.tags.includes('spec') ||
            (f.properties['directory'] as string | undefined ?? '').includes('__tests__'),
        );

        const testFunctions = functions.filter(
          (fn) =>
            fn.tags.includes('test') ||
            fn.tags.includes('spec') ||
            fn.properties['is_test'] === true ||
            /^(test|it|describe|spec)/i.test(fn.name),
        );

        if (testFiles.length === 0 && testFunctions.length === 0) {
          findings.push(
            createFinding({
              title: 'No test coverage detected for API endpoints',
              description:
                `The project has ${endpoints.length} API endpoint(s) but no test files or ` +
                `test functions were found in the knowledge graph. API endpoints are critical ` +
                `integration points that should have automated tests to prevent regressions ` +
                `and validate contracts.`,
              severity: 'high',
              category: 'product',
              analyzer_id: this.id,
              evidence: [
                createEvidence({
                  type: 'metric',
                  source: 'product.cross-cutting',
                  description: `${endpoints.length} endpoints, 0 test files, 0 test functions`,
                  entity_ids: endpoints.slice(0, 10).map((e) => e.id),
                  confidence: 0.85,
                  data: {
                    endpoint_count: endpoints.length,
                    test_file_count: 0,
                    test_function_count: 0,
                  },
                }),
              ],
              locations: [],
              suggested_fix:
                'Add integration tests for each API endpoint covering happy paths, edge cases, authentication, and error scenarios. Use a test framework like Jest, Vitest, or pytest.',
              confidence: 0.8,
              tags: ['no-tests', 'product', 'quality', 'api', 'coverage'],
            }),
          );
        }

        // Cross-cutting check: feature documentation gap
        let docEntities: Entity[] = [];
        try {
          docEntities = await ctx.graph.getEntities('document');
        } catch {
          // document entity type may not exist
        }

        // Also check ADRs and RFCs as documentation
        let adrs: Entity[] = [];
        let rfcs: Entity[] = [];
        try {
          adrs = await ctx.graph.getEntities('adr');
        } catch { /* may not exist */ }
        try {
          rfcs = await ctx.graph.getEntities('rfc');
        } catch { /* may not exist */ }

        const totalDocs = docEntities.length + adrs.length + rfcs.length;

        if (totalDocs > 0 && endpoints.length > totalDocs * 3) {
          const ratio = (endpoints.length / totalDocs).toFixed(1);
          findings.push(
            createFinding({
              title: 'Feature documentation gap',
              description:
                `The project has ${endpoints.length} endpoint(s) but only ${totalDocs} ` +
                `documentation entit${totalDocs === 1 ? 'y' : 'ies'} (${ratio}:1 ratio). ` +
                `A ratio above 3:1 suggests many features ship without corresponding documentation, ` +
                `making it harder for users and developers to understand the product surface.`,
              severity: 'low',
              category: 'product',
              analyzer_id: this.id,
              evidence: [
                createEvidence({
                  type: 'metric',
                  source: 'product.cross-cutting',
                  description: `Endpoint-to-documentation ratio: ${ratio}:1`,
                  entity_ids: endpoints.slice(0, 10).map((e) => e.id),
                  confidence: 0.7,
                  data: {
                    endpoint_count: endpoints.length,
                    documentation_count: totalDocs,
                    ratio: parseFloat(ratio),
                  },
                }),
              ],
              locations: [],
              suggested_fix:
                'Create documentation for undocumented features. Consider auto-generating API reference docs from endpoint metadata and supplementing with usage guides.',
              confidence: 0.65,
              tags: ['documentation-gap', 'product', 'documentation', 'feature-coverage'],
            }),
          );
        } else if (endpoints.length > 3 && totalDocs === 0) {
          findings.push(
            createFinding({
              title: 'Feature documentation gap',
              description:
                `The project has ${endpoints.length} endpoint(s) but zero documentation entities. ` +
                `Product features are effectively undocumented, which hampers adoption and increases ` +
                `the support burden.`,
              severity: 'medium',
              category: 'product',
              analyzer_id: this.id,
              evidence: [
                createEvidence({
                  type: 'metric',
                  source: 'product.cross-cutting',
                  description: `${endpoints.length} endpoints, 0 documentation entities`,
                  entity_ids: endpoints.slice(0, 10).map((e) => e.id),
                  confidence: 0.75,
                  data: {
                    endpoint_count: endpoints.length,
                    documentation_count: 0,
                  },
                }),
              ],
              locations: [],
              suggested_fix:
                'Create feature documentation for each major product area. Start with the most-used endpoints and work outward.',
              confidence: 0.7,
              tags: ['documentation-gap', 'product', 'documentation', 'feature-coverage'],
            }),
          );
        }
      }
    } catch {
      // If entity types don't exist, return empty findings
    }

    return findings;
  }

  // ── Rule 1: Dead Feature Flags ──────────────────────────────────────

  /**
   * Detect feature flags that are always enabled, always disabled, or
   * no longer referenced in code.
   *
   * @param ctx - Analysis context.
   * @returns Findings for dead feature flags.
   */
  private async detectDeadFeatureFlags(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const featureFlags = await ctx.graph.getEntities('feature_flag');

    for (const flag of featureFlags) {
      // Check if flag is always on
      const isAlwaysOn =
        flag.properties['always_enabled'] === true ||
        flag.properties['value'] === true ||
        flag.properties['percentage'] === 100 ||
        flag.tags.includes('always-on');

      // Check if flag is always off
      const isAlwaysOff =
        flag.properties['always_disabled'] === true ||
        flag.properties['value'] === false ||
        flag.properties['percentage'] === 0 ||
        flag.tags.includes('always-off');

      // Check if flag is referenced
      const rels = await ctx.graph.getRelationships(flag.id, 'in');
      const isUnused = rels.length === 0 && flag.tags.includes('unused');

      if (isAlwaysOn) {
        const loc = locationFromEntity(flag);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Feature flag always enabled: ${flag.name}`,
            description: `Feature flag '${flag.name}' is permanently enabled (100% rollout). The flag check is dead code and should be removed. The feature is now baseline functionality.`,
            severity: 'low',
            category: 'product',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Feature flag set to always-on state',
                entity_ids: [flag.id],
                confidence: 0.85,
                data: { state: 'always_on' },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Remove the feature flag check for '${flag.name}' and clean up the flag definition. The feature is fully rolled out and the conditional logic is unnecessary.`,
            confidence: 0.8,
            tags: ['dead-feature-flag', 'product', 'cleanup'],
          }),
        );
      }

      if (isAlwaysOff) {
        const loc = locationFromEntity(flag);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Feature flag always disabled: ${flag.name}`,
            description: `Feature flag '${flag.name}' is permanently disabled. The code behind this flag is unreachable dead code. Either remove the feature or enable the flag.`,
            severity: 'medium',
            category: 'product',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Feature flag set to always-off state',
                entity_ids: [flag.id],
                confidence: 0.85,
                data: { state: 'always_off' },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Either enable the feature flag '${flag.name}' or remove the dead code behind it. Dead code increases maintenance burden and cognitive load.`,
            confidence: 0.8,
            tags: ['dead-feature-flag', 'product', 'dead-code'],
          }),
        );
      }

      if (isUnused) {
        const loc = locationFromEntity(flag);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Unused feature flag: ${flag.name}`,
            description: `Feature flag '${flag.name}' exists but is not referenced anywhere in the codebase. It may be a leftover from a previous feature rollout.`,
            severity: 'low',
            category: 'product',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: 'Feature flag with zero references',
                entity_ids: [flag.id],
                confidence: 0.7,
                data: { state: 'unused', reference_count: 0 },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Remove the unused feature flag '${flag.name}' from the flag management system and any configuration files.`,
            confidence: 0.65,
            tags: ['unused-feature-flag', 'product', 'cleanup'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: Missing Analytics Tracking ──────────────────────────────

  /**
   * Detect key user actions and endpoints without analytics tracking.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing analytics.
   */
  private async detectMissingAnalytics(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');
    const functions = await ctx.graph.getEntities('function');
    const businessMetrics = await ctx.graph.getEntities('business_metric');

    // Check if any analytics infrastructure exists
    const hasAnalytics =
      businessMetrics.length > 0 ||
      functions.some(
        (fn) =>
          fn.tags.includes('analytics') ||
          fn.tags.includes('tracking') ||
          /track|analytics|telemetry|event/i.test(fn.name),
      );

    // Important endpoints (mutation endpoints) without tracking
    const mutationEndpoints = endpoints.filter(
      (e) => {
        const method = ((e.properties['method'] as string | undefined) ??
          (e.properties['http_method'] as string | undefined) ?? '').toUpperCase();
        return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      },
    );

    const untrackedEndpoints = mutationEndpoints.filter(
      (e) =>
        e.properties['has_analytics'] !== true &&
        e.properties['tracked'] !== true &&
        !e.tags.includes('tracked') &&
        !e.tags.includes('analytics'),
    );

    if (untrackedEndpoints.length > 0 && !hasAnalytics) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No analytics tracking detected',
          description: `The project has ${mutationEndpoints.length} mutation endpoint(s) but no analytics tracking infrastructure was detected. Without analytics, you are making product decisions blind — you cannot know which features are used, how users behave, or where they drop off.`,
          severity: 'medium',
          category: 'product',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${mutationEndpoints.length} mutation endpoints without analytics`,
              entity_ids: untrackedEndpoints.slice(0, 10).map((e) => e.id),
              confidence: 0.75,
              data: {
                total_mutations: mutationEndpoints.length,
                untracked: untrackedEndpoints.length,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            'Integrate an analytics platform (Mixpanel, Amplitude, PostHog, or a custom solution). Track key user actions: sign-ups, feature usage, conversions, and errors.',
          confidence: 0.7,
          tags: ['missing-analytics', 'product', 'tracking'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 3: No A/B Testing ──────────────────────────────────────────

  /**
   * Detect the absence of A/B testing or experimentation infrastructure.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing A/B testing.
   */
  private async detectMissingABTesting(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const experiments = await ctx.graph.getEntities('experiment');
    const featureFlags = await ctx.graph.getEntities('feature_flag');
    const functions = await ctx.graph.getEntities('function');

    const hasExperimentation =
      experiments.length > 0 ||
      featureFlags.some((ff) => ff.properties['is_experiment'] === true) ||
      functions.some(
        (fn) =>
          fn.tags.includes('ab-test') ||
          fn.tags.includes('experiment') ||
          /experiment|abTest|variant|bucket/i.test(fn.name),
      );

    // Only flag if the project is mature enough (has multiple endpoints)
    const endpoints = await ctx.graph.getEntities('endpoint');

    if (!hasExperimentation && endpoints.length >= 5) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No A/B testing infrastructure',
          description:
            'No experimentation or A/B testing infrastructure was detected. Data-driven product development requires the ability to test hypotheses with controlled experiments before full rollout.',
          severity: 'low',
          category: 'product',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: 'No experiment entities or A/B test patterns found',
              entity_ids: [],
              confidence: 0.65,
              data: { experiment_count: 0, endpoint_count: endpoints.length },
            }),
          ],
          locations: [],
          suggested_fix:
            'Integrate an experimentation platform (LaunchDarkly, Split.io, Statsig, or a custom solution). Start with simple A/B tests on key conversion flows.',
          confidence: 0.6,
          tags: ['missing-ab-testing', 'product', 'experimentation'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 4: Missing Onboarding ──────────────────────────────────────

  /**
   * Detect the absence of user onboarding flows.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing onboarding.
   */
  private async detectMissingOnboarding(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    const workflows = await ctx.graph.getEntities('workflow');

    const hasOnboarding =
      functions.some(
        (fn) =>
          /onboard|welcome|setup|wizard|intro|tour|getting.?started/i.test(fn.name) ||
          fn.tags.includes('onboarding') ||
          fn.properties['is_onboarding'] === true,
      ) ||
      workflows.some(
        (w) =>
          /onboard|setup|welcome/i.test(w.name) ||
          w.tags.includes('onboarding'),
      );

    // Only flag for user-facing applications (has endpoints and UI components)
    const endpoints = await ctx.graph.getEntities('endpoint');
    const hasUI = functions.some(
      (fn) => fn.tags.includes('component') || fn.properties['is_component'] === true,
    );

    if (!hasOnboarding && endpoints.length > 0 && hasUI) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No onboarding flow detected',
          description:
            'No user onboarding flow was detected. First-time users need guided setup or a tour to understand the product and reach their first "aha moment" quickly. Without onboarding, user activation and retention suffer.',
          severity: 'low',
          category: 'product',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: 'No onboarding-related functions or workflows found',
              entity_ids: [],
              confidence: 0.6,
            }),
          ],
          locations: [],
          suggested_fix:
            'Implement a first-run onboarding experience: welcome screen, guided tour, setup wizard, or progressive disclosure. Track completion rates and time-to-first-value.',
          confidence: 0.55,
          tags: ['missing-onboarding', 'product', 'activation'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 5: No Feedback Mechanism ───────────────────────────────────

  /**
   * Detect the absence of a user feedback mechanism.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing feedback mechanism.
   */
  private async detectMissingFeedback(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    const endpoints = await ctx.graph.getEntities('endpoint');

    const hasFeedback =
      functions.some(
        (fn) =>
          /feedback|survey|nps|csat|rating|review|report.?bug|contact/i.test(fn.name) ||
          fn.tags.includes('feedback') ||
          fn.properties['is_feedback'] === true,
      ) ||
      endpoints.some(
        (e) =>
          (e.properties['path'] as string | undefined ?? '').includes('feedback') ||
          (e.properties['path'] as string | undefined ?? '').includes('survey') ||
          e.tags.includes('feedback'),
      );

    // Only flag for user-facing applications
    const hasUI = functions.some(
      (fn) => fn.tags.includes('component') || fn.properties['is_component'] === true,
    );

    if (!hasFeedback && endpoints.length > 0 && hasUI) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No user feedback mechanism detected',
          description:
            'No feedback collection mechanism was detected (contact form, survey, NPS, bug report, etc.). Without a feedback channel, you miss critical user insights that drive product improvement and user satisfaction.',
          severity: 'low',
          category: 'product',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: 'No feedback-related endpoints or components found',
              entity_ids: [],
              confidence: 0.6,
            }),
          ],
          locations: [],
          suggested_fix:
            'Add a feedback mechanism: in-app feedback widget, contact form, NPS survey, or bug reporting tool (e.g., Sentry user feedback, Canny, UserVoice). Make it easy for users to report issues and suggest improvements.',
          confidence: 0.55,
          tags: ['missing-feedback', 'product', 'user-voice'],
        }),
      );
    }

    return findings;
  }
}
