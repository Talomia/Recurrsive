/**
 * @module @recurrsive/server/routes/policies
 *
 * Policy evaluation and governance routes.
 *
 * Provides endpoints for listing active policies, evaluating
 * opportunities against policies, and checking policy compliance.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { state } from '../state.js';
import { PolicyEngine, BUILTIN_POLICIES } from '@recurrsive/policy';
import { authMiddleware } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register policy enforcement routes.
 *
 * @param app - Fastify instance.
 */
export async function registerPolicyRoutes(app: FastifyInstance): Promise<void> {
  // Lazily-initialized policy engine with built-in policies
  let engine: PolicyEngine | null = null;

  function getEngine(): PolicyEngine {
    if (!engine) {
      engine = new PolicyEngine(BUILTIN_POLICIES);
    }
    return engine;
  }

  /**
   * GET /api/v1/policies
   *
   * List all active policy sets and their rules.
   */
  app.get('/api/v1/policies', { preHandler: [authMiddleware] }, async (_request, reply) => {
    try {
      const pe = getEngine();
      const policySets = pe.getPolicies();

      return reply.status(200).send({
        data: policySets.map((ps) => ({
          id: ps.id,
          name: ps.name,
          description: ps.description,
          enabled: ps.enabled,
          rule_count: ps.rules.length,
          rules: ps.rules.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            scope: r.scope,
            action: r.action,
            condition: r.condition,
          })),
        })),
        total: policySets.length,
        builtin_count: BUILTIN_POLICIES.length,
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  /**
   * GET /api/v1/policies/:id
   *
   * Return a single policy set by its ID with full rule details.
   */
  app.get<{ Params: { id: string } }>('/api/v1/policies/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const pe = getEngine();
      const ps = pe.getPolicySet(request.params.id);

      if (!ps) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Policy set '${request.params.id}' not found.`,
        });
      }

      return reply.status(200).send({
        data: {
          id: ps.id,
          name: ps.name,
          description: ps.description,
          enabled: ps.enabled,
          rule_count: ps.rules.length,
          rules: ps.rules.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            scope: r.scope,
            action: r.action,
            condition: r.condition,
            message: r.message,
            metadata: r.metadata,
          })),
        },
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  /**
   * POST /api/v1/policies/evaluate
   *
   * Evaluate all opportunities against active policies and return
   * a compliance report.
   *
   * Request body (optional):
   * - opportunity_ids: string[] — Evaluate only these opportunities
   *   (defaults to all)
   */
  app.post<{ Body: { opportunity_ids?: string[] } }>(
    '/api/v1/policies/evaluate',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      try {
        const pe = getEngine();
        const manager = state.getOpportunities();
        const allOpportunities = manager.list();

        // Filter if specific IDs are requested
        const ids = request.body?.opportunity_ids;
        const opportunities = ids
          ? allOpportunities.filter((o) => ids.includes(o.id))
          : allOpportunities;

        const results = opportunities.map((opp) => {
          const result = pe.passes(opp);
          return {
            opportunity_id: opp.id,
            opportunity_title: opp.title,
            passed: result.passed,
            action: result.effectiveAction,
            violations: result.violations.map((v) => ({
              rule_id: v.rule_id,
              action: v.action,
              message: v.message,
            })),
            warnings: result.warnings.map((w) => ({
              rule_id: w.rule_id,
              message: w.message,
            })),
          };
        });

        const passed = results.filter((r) => r.passed).length;
        const blocked = results.filter((r) => r.action === 'block').length;
        const needsApproval = results.filter((r) => r.action === 'require_approval').length;
        const warned = results.filter((r) => !r.passed && r.action === 'warn').length;

        return reply.status(200).send({
          data: {
            results,
            summary: {
              total: results.length,
              passed,
              blocked,
              needs_approval: needsApproval,
              warned,
              compliance_rate: results.length > 0
                ? Math.round((passed / results.length) * 100)
                : 100,
            },
          },
        });
      } catch (err) {
        return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
      }
    },
  );

  /**
   * GET /api/v1/policies/compliance
   *
   * Quick compliance check — returns the overall compliance rate
   * without full evaluation details.
   */
  app.get('/api/v1/policies/compliance', { preHandler: [authMiddleware] }, async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze first.',
      });
    }

    try {
      const pe = getEngine();
      const allOpportunities = state.getOpportunities().list();

      let passed = 0;
      let blocked = 0;
      let total = 0;

      for (const opp of allOpportunities) {
        const result = pe.passes(opp);
        total++;
        if (result.passed) passed++;
        if (result.effectiveAction === 'block') blocked++;
      }

      return reply.status(200).send({
        data: {
          total_opportunities: total,
          compliant: passed,
          blocked,
          compliance_rate: total > 0 ? Math.round((passed / total) * 100) : 100,
          policy_sets_active: pe.getPolicies().filter((ps) => ps.enabled).length,
        },
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });
}
