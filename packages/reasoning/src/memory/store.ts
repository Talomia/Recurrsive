/**
 * File-based learning memory store.
 *
 * Records decisions (accepted/rejected) and outcomes for opportunities
 * to enable learning over time. Tracks per-specialist accuracy so the
 * reasoning engine can weight specialist opinions by historical
 * reliability.
 *
 * Storage format: JSON files in a configurable directory.
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '@recurrsive/core';
import type { SpecialistRole } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'reasoning:memory' } });

// ---------------------------------------------------------------------------
// Storage types
// ---------------------------------------------------------------------------

/** A recorded decision about an opportunity. */
interface DecisionRecord {
  /** Opportunity ID. */
  opportunity_id: string;
  /** Decision: accepted or rejected. */
  decision: 'accepted' | 'rejected';
  /** Optional reason for the decision. */
  reason?: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Specialist role that proposed this opportunity (if known). */
  proposed_by?: SpecialistRole;
  /** Category of the opportunity. */
  category?: string;
}

/** A recorded outcome after an opportunity was implemented. */
interface OutcomeRecord {
  /** Opportunity ID. */
  opportunity_id: string;
  /** Structured outcome data. */
  outcome: Record<string, unknown>;
  /** Whether the outcome was considered successful. */
  success: boolean;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Specialist role that proposed this opportunity (if known). */
  proposed_by?: SpecialistRole;
}

/** The complete memory store file format. */
interface MemoryData {
  /** Version of the memory format. */
  version: string;
  /** Recorded decisions. */
  decisions: DecisionRecord[];
  /** Recorded outcomes. */
  outcomes: OutcomeRecord[];
  /** Last updated timestamp. */
  updated_at: string;
}

// ---------------------------------------------------------------------------
// FileMemoryStore
// ---------------------------------------------------------------------------

/**
 * Persistent learning memory stored as JSON files on disk.
 *
 * Tracks:
 * - Which opportunities were accepted vs rejected
 * - Implementation outcomes (success/failure)
 * - Per-specialist accuracy rates
 * - Patterns in accepted/rejected categories
 *
 * @example
 * ```ts
 * const store = new FileMemoryStore('/path/to/memory');
 * await store.recordDecision('opp-123', 'accepted', 'High ROI');
 * const accuracy = await store.getSpecialistAccuracy('architecture_engineer');
 * ```
 */
export class FileMemoryStore {
  private readonly storagePath: string;
  private readonly dataFile: string;
  private dataCache: MemoryData | null = null;

  /**
   * @param storagePath - Directory to store memory files in.
   */
  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.dataFile = path.join(storagePath, 'reasoning_memory.json');
  }

  /**
   * Record a decision about an opportunity.
   *
   * @param opportunityId - The opportunity's unique ID.
   * @param decision - Whether the opportunity was accepted or rejected.
   * @param reason - Optional reason for the decision.
   * @param proposedBy - Optional specialist role that proposed it.
   * @param category - Optional category for pattern tracking.
   */
  async recordDecision(
    opportunityId: string,
    decision: 'accepted' | 'rejected',
    reason?: string,
    proposedBy?: SpecialistRole,
    category?: string,
  ): Promise<void> {
    const data = await this.load();

    const record: DecisionRecord = {
      opportunity_id: opportunityId,
      decision,
      reason,
      timestamp: new Date().toISOString(),
      proposed_by: proposedBy,
      category,
    };

    // Upsert — replace existing decision for same opportunity
    const existingIdx = data.decisions.findIndex(
      (d) => d.opportunity_id === opportunityId,
    );
    if (existingIdx >= 0) {
      data.decisions[existingIdx] = record;
    } else {
      data.decisions.push(record);
    }

    data.updated_at = new Date().toISOString();
    await this.save(data);

    logger.debug(
      `Recorded decision: ${opportunityId} → ${decision}${reason ? ` (${reason})` : ''}`,
    );
  }

  /**
   * Record the outcome after an opportunity was implemented.
   *
   * @param opportunityId - The opportunity's unique ID.
   * @param outcome - Structured outcome data.
   * @param proposedBy - Optional specialist role that proposed it.
   */
  async recordOutcome(
    opportunityId: string,
    outcome: Record<string, unknown>,
    proposedBy?: SpecialistRole,
  ): Promise<void> {
    const data = await this.load();

    // Determine success from outcome data, default to unknown
    const success = outcome['success'] === true ||
      outcome['status'] === 'success' ||
      outcome['validated'] === true;

    const record: OutcomeRecord = {
      opportunity_id: opportunityId,
      outcome,
      success,
      timestamp: new Date().toISOString(),
      proposed_by: proposedBy,
    };

    // Upsert
    const existingIdx = data.outcomes.findIndex(
      (o) => o.opportunity_id === opportunityId,
    );
    if (existingIdx >= 0) {
      data.outcomes[existingIdx] = record;
    } else {
      data.outcomes.push(record);
    }

    data.updated_at = new Date().toISOString();
    await this.save(data);

    logger.debug(
      `Recorded outcome: ${opportunityId} → ${success ? 'success' : 'failure'}`,
    );
  }

  /**
   * Calculate per-specialist accuracy based on recorded outcomes.
   *
   * Accuracy = (accepted opportunities with successful outcomes) / (total outcomes for this specialist).
   *
   * @param role - The specialist role to check.
   * @returns Accuracy statistics: correct count, total count, and ratio.
   */
  async getSpecialistAccuracy(
    role: SpecialistRole,
  ): Promise<{ correct: number; total: number; accuracy: number }> {
    const data = await this.load();

    // Find outcomes where the proposer matches the role
    const roleOutcomes = data.outcomes.filter((o) => o.proposed_by === role);

    if (roleOutcomes.length === 0) {
      return { correct: 0, total: 0, accuracy: 0 };
    }

    // Also check decisions — count as correct if:
    // 1. Accepted and outcome was successful, OR
    // 2. Rejected and outcome was unsuccessful (correctly identified as not worth doing)
    const correct = roleOutcomes.filter((outcome) => {
      const decision = data.decisions.find(
        (d) => d.opportunity_id === outcome.opportunity_id,
      );
      if (!decision) return outcome.success;

      if (decision.decision === 'accepted') {
        return outcome.success;
      } else {
        // Rejected — we consider it "correct" if the outcome was negative
        // (i.e., we were right to reject)
        return !outcome.success;
      }
    }).length;

    return {
      correct,
      total: roleOutcomes.length,
      accuracy: roleOutcomes.length > 0 ? correct / roleOutcomes.length : 0,
    };
  }

  /**
   * Get patterns (categories/reasons) of accepted opportunities.
   *
   * @param category - Optional category filter.
   * @returns Array of reason/description strings from accepted decisions.
   */
  async getAcceptedPatterns(category?: string): Promise<string[]> {
    const data = await this.load();

    return data.decisions
      .filter((d) => {
        if (d.decision !== 'accepted') return false;
        if (category && d.category !== category) return false;
        return true;
      })
      .map((d) => d.reason ?? `Accepted: ${d.opportunity_id}`)
      .filter((reason, idx, arr) => arr.indexOf(reason) === idx); // deduplicate
  }

  /**
   * Get patterns (categories/reasons) of rejected opportunities.
   *
   * @param category - Optional category filter.
   * @returns Array of reason/description strings from rejected decisions.
   */
  async getRejectedPatterns(category?: string): Promise<string[]> {
    const data = await this.load();

    return data.decisions
      .filter((d) => {
        if (d.decision !== 'rejected') return false;
        if (category && d.category !== category) return false;
        return true;
      })
      .map((d) => d.reason ?? `Rejected: ${d.opportunity_id}`)
      .filter((reason, idx, arr) => arr.indexOf(reason) === idx); // deduplicate
  }

  /**
   * Get the total number of decisions recorded.
   *
   * @returns Count of decision records.
   */
  async getDecisionCount(): Promise<number> {
    const data = await this.load();
    return data.decisions.length;
  }

  /**
   * Get the total number of outcomes recorded.
   *
   * @returns Count of outcome records.
   */
  async getOutcomeCount(): Promise<number> {
    const data = await this.load();
    return data.outcomes.length;
  }

  // ── Persistence helpers ──────────────────────────────────────────────────

  /**
   * Load memory data from disk. Returns cached data if available.
   *
   * @returns The loaded or initialized memory data.
   */
  private async load(): Promise<MemoryData> {
    if (this.dataCache) {
      return this.dataCache;
    }

    try {
      const raw = await fs.readFile(this.dataFile, 'utf-8');
      this.dataCache = JSON.parse(raw) as MemoryData;
      return this.dataCache;
    } catch (err) {
      // File doesn't exist or is corrupt — initialize empty
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code?: string }).code === 'ENOENT'
      ) {
        logger.debug('Memory file not found, initializing empty store');
      } else {
        // The file EXISTS but could not be read/parsed. The next save() would
        // silently overwrite it, permanently destroying whatever history it
        // held — back it up first so the data stays recoverable.
        const backupPath = `${this.dataFile}.corrupt-${Date.now()}`;
        try {
          await fs.copyFile(this.dataFile, backupPath);
          logger.warn(
            `Failed to load memory file, initializing empty ` +
            `(corrupt file backed up to ${backupPath}): ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
        } catch (backupErr) {
          logger.warn(
            `Failed to load memory file, initializing empty ` +
            `(backup of corrupt file also failed: ` +
            `${backupErr instanceof Error ? backupErr.message : String(backupErr)}): ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const empty: MemoryData = {
        version: '1',
        decisions: [],
        outcomes: [],
        updated_at: new Date().toISOString(),
      };

      this.dataCache = empty;
      return empty;
    }
  }

  /**
   * Save memory data to disk.
   *
   * @param data - The memory data to persist.
   */
  private async save(data: MemoryData): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
      this.dataCache = data;
    } catch (err) {
      logger.error(
        `Failed to save memory file: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
