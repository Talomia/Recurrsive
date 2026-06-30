/**
 * @module @recurrsive/analyzers/ux
 *
 * UX analyzer — examines the knowledge graph for user-experience
 * issues such as missing loading states, error messages, empty states,
 * accessibility problems, and missing confirmation dialogs.
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
 * Analyzes the knowledge graph for UX gaps and accessibility issues.
 *
 * ### Rules
 * 1. **Missing loading states** — async operations without loading indicators.
 * 2. **Missing error messages** — error handling without user-facing messages.
 * 3. **Missing empty states** — list/collection views without empty states.
 * 4. **Accessibility issues** — components missing ARIA attributes or labels.
 * 5. **Missing confirmation dialogs** — destructive actions without confirmation.
 *
 * @example
 * ```ts
 * const analyzer = new UXAnalyzer();
 * await analyzer.initialize(ctx);
 * const findings = await analyzer.analyze(ctx);
 * ```
 */
export class UXAnalyzer implements Analyzer {
  readonly id = 'ux.quality';
  readonly name = 'UX Analyzer';
  readonly description =
    'Detects UX issues: missing loading states, error messages, empty states, accessibility problems, and missing confirmation dialogs for destructive actions.';
  readonly version = '0.1.0';
  readonly categories = ['ux' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      loadingStates,
      errorMessages,
      emptyStates,
      accessibility,
      confirmationDialogs,
    ] = await Promise.all([
      this.detectMissingLoadingStates(ctx),
      this.detectMissingErrorMessages(ctx),
      this.detectMissingEmptyStates(ctx),
      this.detectAccessibilityIssues(ctx),
      this.detectMissingConfirmationDialogs(ctx),
    ]);

    findings.push(
      ...loadingStates,
      ...errorMessages,
      ...emptyStates,
      ...accessibility,
      ...confirmationDialogs,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      let endpoints: Entity[] = [];
      try {
        endpoints = await ctx.graph.getEntities('endpoint');
      } catch {
        // endpoint entity type may not exist
      }

      if (endpoints.length > 0) {
        // Cross-cutting check: error states without loading states
        const errorEndpoints = endpoints.filter(
          (e) =>
            /error|fail|exception|fault/i.test(e.name) ||
            e.tags.includes('error') ||
            e.tags.includes('error-handler') ||
            e.properties['handles_errors'] === true,
        );

        const loadingEndpoints = endpoints.filter(
          (e) =>
            /load|skeleton|spinner|pending|progress/i.test(e.name) ||
            e.tags.includes('loading') ||
            e.tags.includes('skeleton') ||
            e.properties['has_loading_state'] === true,
        );

        // Also check functions for loading patterns
        let functions: Entity[] = [];
        try {
          functions = await ctx.graph.getEntities('function');
        } catch {
          // function entity type may not exist
        }

        const hasLoadingPatterns =
          loadingEndpoints.length > 0 ||
          functions.some(
            (fn) =>
              fn.tags.includes('loading-state') ||
              fn.tags.includes('skeleton') ||
              fn.properties['has_loading_state'] === true ||
              /skeleton|spinner|loading/i.test(fn.name),
          );

        if (errorEndpoints.length > 0 && !hasLoadingPatterns) {
          findings.push(
            createFinding({
              title: 'Error states without loading states',
              description:
                `The project has ${errorEndpoints.length} error-related endpoint(s) or patterns ` +
                `but no loading/skeleton state patterns were detected. Good UX requires both: ` +
                `loading indicators tell users something is happening, while error states ` +
                `communicate when something went wrong.`,
              severity: 'medium',
              category: 'ux',
              analyzer_id: this.id,
              evidence: [
                createEvidence({
                  type: 'metric',
                  source: 'ux.cross-cutting',
                  description: `${errorEndpoints.length} error patterns, 0 loading patterns`,
                  entity_ids: errorEndpoints.slice(0, 10).map((e) => e.id),
                  confidence: 0.7,
                  data: {
                    error_pattern_count: errorEndpoints.length,
                    loading_pattern_count: 0,
                  },
                }),
              ],
              locations: [],
              suggested_fix:
                'Add loading state indicators (spinners, skeleton screens, progress bars) for all async operations. Use Suspense boundaries or loading state hooks for consistent loading UX.',
              confidence: 0.65,
              tags: ['missing-loading', 'ux', 'error-handling', 'loading-states'],
            }),
          );
        }

        // Cross-cutting check: no internationalization in multi-endpoint app
        if (endpoints.length > 5) {
          let configs: Entity[] = [];
          try {
            configs = await ctx.graph.getEntities('config');
          } catch {
            // config entity type may not exist
          }

          const hasI18n =
            configs.some(
              (c) =>
                /i18n|intl|locale|l10n|translation/i.test(c.name) ||
                c.tags.includes('i18n') ||
                c.tags.includes('internationalization') ||
                c.tags.includes('localization') ||
                c.properties['type'] === 'i18n',
            ) ||
            functions.some(
              (fn) =>
                /translate|i18n|intl|formatMessage|useTranslation|t\(/i.test(fn.name) ||
                fn.tags.includes('i18n'),
            );

          if (!hasI18n) {
            findings.push(
              createFinding({
                title: 'No internationalization detected in multi-endpoint app',
                description:
                  `The project has ${endpoints.length} endpoints, suggesting a substantial ` +
                  `application, but no internationalization (i18n) or localization configuration ` +
                  `was detected. Retrofitting i18n after launch is significantly more expensive ` +
                  `than building it in from the start.`,
                severity: 'low',
                category: 'ux',
                analyzer_id: this.id,
                evidence: [
                  createEvidence({
                    type: 'metric',
                    source: 'ux.cross-cutting',
                    description: `${endpoints.length} endpoints, 0 i18n/l10n configurations`,
                    entity_ids: [],
                    confidence: 0.6,
                    data: {
                      endpoint_count: endpoints.length,
                      config_count: configs.length,
                      i18n_detected: false,
                    },
                  }),
                ],
                locations: [],
                suggested_fix:
                  'Integrate an i18n framework (react-intl, next-intl, i18next, vue-i18n). Extract all user-facing strings into translation files. Even for single-language apps, this prepares the codebase for future localization.',
                confidence: 0.55,
                tags: ['no-i18n', 'ux', 'internationalization', 'localization'],
              }),
            );
          }
        }
      }
    } catch {
      // If entity types don't exist, return empty findings
    }

    return findings;
  }

  // ── Rule 1: Missing Loading States ──────────────────────────────────

  /**
   * Detect async data-fetching operations that lack loading state
   * handling.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing loading states.
   */
  private async detectMissingLoadingStates(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    // endpoints available via ctx.graph.getEntities('endpoint') if needed

    // Look for async functions that fetch data but don't track loading
    const asyncFunctions = functions.filter(
      (fn) =>
        fn.properties['is_async'] === true ||
        fn.tags.includes('async'),
    );

    for (const fn of asyncFunctions) {
      // Heuristic: functions that look like data fetching hooks/handlers
      const isFetcher =
        /^(use|fetch|load|get|query)/i.test(fn.name) ||
        fn.tags.includes('data-fetching') ||
        fn.tags.includes('api-call');

      if (!isFetcher) continue;

      const hasLoadingState =
        fn.properties['has_loading_state'] === true ||
        fn.properties['tracks_loading'] === true ||
        fn.tags.includes('loading-state') ||
        fn.tags.includes('has-loading');

      if (!hasLoadingState) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing loading state: ${fn.name}`,
            description: `Async function '${fn.name}' appears to fetch data but does not track loading state. Users should see a loading indicator while data is being fetched to prevent confusion and perceived unresponsiveness.`,
            severity: 'medium',
            category: 'ux',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Async data-fetching function without loading state tracking',
                entity_ids: [fn.id],
                confidence: 0.65,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add an isLoading / isPending state variable. Display a spinner or skeleton screen while the operation is in progress. Consider using React Suspense, SWR, or TanStack Query for automatic loading state management.',
            confidence: 0.6,
            tags: ['missing-loading', 'ux', 'async', 'data-fetching'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: Missing Error Messages ──────────────────────────────────

  /**
   * Detect error handling paths that don't surface user-facing error
   * messages.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing error messages.
   */
  private async detectMissingErrorMessages(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    const endpoints = await ctx.graph.getEntities('endpoint');

    for (const fn of functions) {
      const hasErrorHandling =
        fn.properties['has_try_catch'] === true ||
        fn.properties['has_error_handler'] === true ||
        fn.tags.includes('error-handling');

      const hasUserErrorMessage =
        fn.properties['has_error_message'] === true ||
        fn.properties['has_user_feedback'] === true ||
        fn.tags.includes('error-message') ||
        fn.tags.includes('user-error');

      // Only flag if error handling exists but no user message
      if (hasErrorHandling && !hasUserErrorMessage) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing user-facing error message: ${fn.name}`,
            description: `Function '${fn.name}' has error handling but does not display a user-facing error message. Silent failures leave users confused. Show clear, actionable error messages.`,
            severity: 'medium',
            category: 'ux',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Error handling without user-facing error feedback',
                entity_ids: [fn.id],
                confidence: 0.6,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add a user-facing error message in catch blocks. Use toast notifications, inline error messages, or error boundaries. Log technical details for debugging separately.',
            confidence: 0.55,
            tags: ['missing-error-message', 'ux', 'error-handling'],
          }),
        );
      }
    }

    // Endpoints without error responses
    for (const endpoint of endpoints) {
      const hasErrorResponse =
        endpoint.properties['has_error_response'] === true ||
        endpoint.properties['error_responses'] != null ||
        endpoint.tags.includes('error-responses');

      if (!hasErrorResponse) {
        const path = (endpoint.properties['path'] as string | undefined) ?? endpoint.name;
        const method = (endpoint.properties['method'] as string | undefined) ?? '';
        const loc = locationFromEntity(endpoint);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing error responses: ${method} ${path}`,
            description: `Endpoint '${method} ${path}' does not define explicit error responses. API consumers need clear, structured error responses with appropriate HTTP status codes and error messages.`,
            severity: 'medium',
            category: 'ux',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Endpoint without defined error responses',
                entity_ids: [endpoint.id],
                confidence: 0.65,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Define explicit error responses with appropriate status codes (400, 401, 403, 404, 422, 500). Use a consistent error response schema with `code`, `message`, and `details` fields.',
            confidence: 0.6,
            tags: ['missing-error-response', 'ux', 'api'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Missing Empty States ────────────────────────────────────

  /**
   * Detect list or collection views that don't handle empty states.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing empty states.
   */
  private async detectMissingEmptyStates(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    // Heuristic: look for components/functions that render lists
    const listRenderers = functions.filter(
      (fn) =>
        /list|table|grid|feed|collection|items|results/i.test(fn.name) ||
        fn.tags.includes('list-view') ||
        fn.tags.includes('renders-list') ||
        fn.properties['renders_list'] === true,
    );

    for (const fn of listRenderers) {
      const hasEmptyState =
        fn.properties['has_empty_state'] === true ||
        fn.tags.includes('empty-state') ||
        fn.tags.includes('has-empty-state');

      if (!hasEmptyState) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing empty state: ${fn.name}`,
            description: `Component '${fn.name}' appears to render a list or collection but does not handle the empty state. When there is no data, show a helpful message with a call-to-action instead of a blank page.`,
            severity: 'low',
            category: 'ux',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'List/collection view without empty state handling',
                entity_ids: [fn.id],
                confidence: 0.55,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add an empty state with an illustration, explanatory text, and a primary action (e.g., "Create your first item"). Follow empty state design patterns from your design system.',
            confidence: 0.5,
            tags: ['missing-empty-state', 'ux', 'ui'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 4: Accessibility Issues ────────────────────────────────────

  /**
   * Detect components with potential accessibility problems.
   *
   * @param ctx - Analysis context.
   * @returns Findings for accessibility issues.
   */
  private async detectAccessibilityIssues(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    // files available via ctx.graph.getEntities('file') if needed

    // Look for UI components
    const uiComponents = functions.filter(
      (fn) =>
        fn.tags.includes('component') ||
        fn.tags.includes('ui') ||
        fn.properties['is_component'] === true ||
        /^[A-Z]/.test(fn.name), // PascalCase often indicates React components
    );

    for (const component of uiComponents) {
      const hasA11y =
        component.properties['has_aria_labels'] === true ||
        component.properties['accessible'] === true ||
        component.tags.includes('accessible') ||
        component.tags.includes('a11y');

      const isInteractive =
        component.properties['is_interactive'] === true ||
        component.tags.includes('interactive') ||
        /button|modal|dialog|menu|dropdown|form|input|select|tab|accordion|toggle/i.test(component.name);

      if (isInteractive && !hasA11y) {
        const loc = locationFromEntity(component);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Accessibility concern: ${component.name}`,
            description: `Interactive component '${component.name}' may be missing accessibility attributes (ARIA labels, roles, keyboard navigation). Interactive UI elements must be accessible to users of assistive technology.`,
            severity: 'medium',
            category: 'ux',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Interactive component without accessibility markers',
                entity_ids: [component.id],
                confidence: 0.6,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add appropriate ARIA attributes (aria-label, role, aria-expanded, etc.). Ensure keyboard navigation works (Tab, Enter, Escape). Test with a screen reader. Follow WCAG 2.1 AA guidelines.',
            confidence: 0.55,
            tags: ['accessibility', 'ux', 'a11y', 'wcag'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: Missing Confirmation Dialogs ────────────────────────────

  /**
   * Detect destructive actions that lack confirmation prompts.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing confirmation dialogs.
   */
  private async detectMissingConfirmationDialogs(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    const endpoints = await ctx.graph.getEntities('endpoint');

    // Functions that perform destructive operations
    const destructiveFunctions = functions.filter(
      (fn) =>
        /^(delete|remove|destroy|purge|drop|clear|reset|revoke|terminate|cancel)/i.test(fn.name) ||
        fn.tags.includes('destructive') ||
        fn.properties['is_destructive'] === true,
    );

    for (const fn of destructiveFunctions) {
      const hasConfirmation =
        fn.properties['has_confirmation'] === true ||
        fn.properties['requires_confirmation'] === true ||
        fn.tags.includes('has-confirmation') ||
        fn.tags.includes('confirms');

      if (!hasConfirmation) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing confirmation for destructive action: ${fn.name}`,
            description: `Function '${fn.name}' performs a destructive action but does not appear to require user confirmation. Destructive operations (delete, remove, etc.) should always prompt for confirmation to prevent accidental data loss.`,
            severity: 'medium',
            category: 'ux',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Destructive action without confirmation prompt',
                entity_ids: [fn.id],
                confidence: 0.7,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add a confirmation dialog before executing the destructive action. Use clear language describing what will be deleted/removed. Include an "undo" option where possible.',
            confidence: 0.65,
            tags: ['missing-confirmation', 'ux', 'destructive-action'],
          }),
        );
      }
    }

    // DELETE endpoints without confirmation markers
    const deleteEndpoints = endpoints.filter(
      (e) =>
        (e.properties['method'] as string | undefined)?.toUpperCase() === 'DELETE' ||
        (e.properties['http_method'] as string | undefined)?.toUpperCase() === 'DELETE',
    );

    for (const endpoint of deleteEndpoints) {
      const hasGuard =
        endpoint.properties['requires_confirmation'] === true ||
        endpoint.properties['has_soft_delete'] === true ||
        endpoint.tags.includes('soft-delete') ||
        endpoint.tags.includes('confirmed');

      if (!hasGuard) {
        const path = (endpoint.properties['path'] as string | undefined) ?? endpoint.name;
        const loc = locationFromEntity(endpoint);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `DELETE endpoint without safety guard: ${path}`,
            description: `DELETE endpoint '${path}' has no soft-delete or confirmation mechanism. Consider implementing soft-delete (mark as deleted instead of removing) or requiring a confirmation token to prevent accidental deletions.`,
            severity: 'medium',
            category: 'ux',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'DELETE endpoint without soft-delete or confirmation',
                entity_ids: [endpoint.id],
                confidence: 0.65,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Implement soft-delete by adding a `deleted_at` timestamp column. Alternatively, require a confirmation parameter or use a two-step deletion process.',
            confidence: 0.6,
            tags: ['missing-confirmation', 'ux', 'api', 'destructive-action'],
          }),
        );
      }
    }

    return findings;
  }
}
