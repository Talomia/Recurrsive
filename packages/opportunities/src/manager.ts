/**
 * @module @recurrsive/opportunities/manager
 *
 * Opportunity lifecycle manager — create, update, filter, persist, and
 * export opportunities.
 *
 * @packageDocumentation
 */

import { generateId } from '@recurrsive/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  Opportunity,
  OpportunityCategory,
  OpportunityStatus,
  Severity,
  Impact,
} from '@recurrsive/core';
import { OpportunitySchema } from '@recurrsive/core';
import { computeScore, rankOpportunities } from './ranking.js';
import { exportToSarif } from './sarif.js';
import { exportToMarkdown } from './markdown.js';

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

/** Filter criteria for listing opportunities. */
export interface OpportunityFilters {
  /** Filter by category. */
  category?: OpportunityCategory;
  /** Filter by status. */
  status?: OpportunityStatus;
  /** Filter by severity. */
  severity?: Severity;
  /** Minimum confidence threshold (0–1). */
  minConfidence?: number;
}

/** Supported export format. */
export type ExportFormat = 'json' | 'markdown' | 'sarif';

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

/**
 * Manages the full lifecycle of opportunities: creation, status updates,
 * filtering, ranking, persistence, import/export.
 */
export class OpportunityManager {
  private readonly store = new Map<string, Opportunity>();

  /**
   * Create an OpportunityManager, optionally pre-loading opportunities.
   *
   * @param initial - Optional array of opportunities to seed
   */
  constructor(initial?: readonly Opportunity[]) {
    if (initial) {
      for (const opp of initial) {
        this.store.set(opp.id, opp);
      }
    }
  }

  /**
   * Create a new opportunity with an auto-generated UUID and timestamps.
   *
   * @param data - Opportunity data (without id, created_at, updated_at)
   * @returns The newly created opportunity
   */
  create(data: Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>): Opportunity {
    const now = new Date().toISOString();
    const opp: Opportunity = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };

    const parsed = OpportunitySchema.parse(opp);
    this.store.set(parsed.id, parsed);
    return parsed;
  }

  /**
   * Update the status of an existing opportunity.
   *
   * @param id - Opportunity UUID
   * @param status - New lifecycle status
   * @param reason - Optional reason for the status change
   * @returns The updated opportunity
   * @throws {Error} If the opportunity is not found
   */
  updateStatus(id: string, status: OpportunityStatus, reason?: string): Opportunity {
    const opp = this.store.get(id);
    if (!opp) {
      throw new Error(`Opportunity not found: ${id}`);
    }

    const now = new Date().toISOString();
    const updated: Opportunity = {
      ...opp,
      status,
      updated_at: now,
      decision_reason: reason ?? opp.decision_reason,
      implemented_at: status === 'implemented' ? now : opp.implemented_at,
      validated_at: status === 'validated' ? now : opp.validated_at,
    };

    this.store.set(id, updated);
    return updated;
  }

  /**
   * List opportunities, optionally filtering by criteria.
   *
   * @param filters - Optional filter criteria
   * @returns Array of matching opportunities, sorted by composite score
   */
  list(filters?: OpportunityFilters): Opportunity[] {
    let results = Array.from(this.store.values());

    if (filters) {
      if (filters.category !== undefined) {
        results = results.filter((o) => o.category === filters.category);
      }
      if (filters.status !== undefined) {
        results = results.filter((o) => o.status === filters.status);
      }
      if (filters.severity !== undefined) {
        results = results.filter((o) => o.severity === filters.severity);
      }
      if (filters.minConfidence !== undefined) {
        const min = filters.minConfidence;
        results = results.filter((o) => o.confidence >= min);
      }
    }

    return rankOpportunities(results);
  }

  /**
   * Retrieve a single opportunity by ID.
   *
   * @param id - Opportunity UUID
   * @returns The opportunity, or undefined if not found
   */
  get(id: string): Opportunity | undefined {
    return this.store.get(id);
  }

  /**
   * Get the top N opportunities by composite score.
   *
   * @param n - Number of top opportunities to return
   * @returns Array of top-N opportunities sorted by score (descending)
   */
  getTopN(n: number): Opportunity[] {
    return rankOpportunities(Array.from(this.store.values())).slice(0, n);
  }

  /**
   * Record the actual measured impact after implementation.
   *
   * @param id - Opportunity UUID
   * @param impact - The measured post-implementation impact
   * @returns The updated opportunity
   * @throws {Error} If the opportunity is not found
   */
  recordActualImpact(id: string, impact: Impact): Opportunity {
    const opp = this.store.get(id);
    if (!opp) {
      throw new Error(`Opportunity not found: ${id}`);
    }

    const updated: Opportunity = {
      ...opp,
      actual_impact: impact,
      updated_at: new Date().toISOString(),
    };

    this.store.set(id, updated);
    return updated;
  }

  /**
   * Export all opportunities in the specified format.
   *
   * @param format - Export format: 'json', 'markdown', or 'sarif'
   * @returns The exported string
   * @throws {Error} If the format is unsupported
   */
  export(format: ExportFormat): string {
    const all = rankOpportunities(Array.from(this.store.values()));

    switch (format) {
      case 'json':
        return JSON.stringify(all, null, 2);
      case 'markdown':
        return exportToMarkdown(all);
      case 'sarif':
        return exportToSarif(all);
      default: {
        const _exhaustive: never = format;
        throw new Error(`Unsupported export format: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Import opportunities from a JSON array. Each record is validated
   * against the Opportunity schema; invalid records are skipped with
   * errors collected.
   *
   * @param data - Array of opportunity-like objects
   * @returns Object with counts of imported and skipped items, plus errors
   */
  import(data: unknown[]): { imported: number; skipped: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (const item of data) {
      const result = OpportunitySchema.safeParse(item);
      if (result.success) {
        this.store.set(result.data.id, result.data);
        imported++;
      } else {
        skipped++;
        const id = (item as Record<string, unknown>)?.['id'] ?? 'unknown';
        errors.push(`Invalid opportunity (id: ${String(id)}): ${result.error.message}`);
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Save all opportunities to a JSON file on disk.
   *
   * @param path - Absolute or relative file path
   * @throws {Error} If the write fails
   */
  async save(path: string): Promise<void> {
    const all = Array.from(this.store.values());
    const json = JSON.stringify(all, null, 2);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, json, 'utf-8');
  }

  /**
   * Load opportunities from a JSON file on disk, replacing the current
   * store contents.
   *
   * @param path - Absolute or relative file path
   * @returns Import results (imported / skipped / errors)
   * @throws {Error} If the file cannot be read or parsed
   */
  async load(path: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const raw = await readFile(path, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(`Expected JSON array in ${path}, got ${typeof parsed}`);
    }

    this.store.clear();
    return this.import(parsed);
  }

  /**
   * Get the total count of stored opportunities.
   *
   * @returns Number of opportunities in the manager
   */
  get count(): number {
    return this.store.size;
  }

  /**
   * Get the composite score for a specific opportunity.
   *
   * @param id - Opportunity UUID
   * @returns The composite score, or undefined if not found
   */
  getScore(id: string): number | undefined {
    const opp = this.store.get(id);
    return opp ? computeScore(opp) : undefined;
  }
}
