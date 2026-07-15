/**
 * @module @recurrsive/collectors/base/governance
 *
 * Data governance utilities for applying privacy rules, PII detection,
 * field masking, and audit logging during data collection.
 *
 * @packageDocumentation
 */

import type { DataGovernance, Entity } from '@recurrsive/core';
import { nowISO, createLogger } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// PII Detection Types
// ---------------------------------------------------------------------------

/** A single PII detection match within a text string. */
export interface PIIDetection {
  /** The type of PII detected. */
  type: PIIType;
  /** The matched text. */
  match: string;
  /** Start index within the source text. */
  start: number;
  /** End index within the source text. */
  end: number;
}

/** Supported PII categories for detection. */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'api_key'
  | 'jwt_token';

/** An entry in the governance audit log. */
export interface AuditEntry {
  /** ISO-8601 timestamp of the audit event. */
  timestamp: string;
  /** Descriptive action that was audited. */
  action: string;
  /** Structured details about the audited event. */
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// PII Pattern Definitions
// ---------------------------------------------------------------------------

/**
 * Compiled regex patterns for PII detection.
 * Each pattern is designed to have low false-positive rates on
 * typical source-code / documentation content.
 */
const PII_PATTERNS: ReadonlyArray<{ type: PIIType; pattern: RegExp }> = [
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
  {
    type: 'phone',
    // US / international formats: +1-555-555-5555, (555) 555-5555, etc.
    pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g,
  },
  {
    type: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    type: 'credit_card',
    // Visa, Mastercard, Amex, Discover — 13-19 digits with optional separators
    pattern: /\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b/g,
  },
  {
    type: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
  {
    type: 'api_key',
    // Generic "secret-looking" hex/base64 strings prefixed with common key names
    pattern: /(?:api[_-]?key|secret|token|password|auth)\s*[:=]\s*['"]?([A-Za-z0-9+/=_-]{20,})['"]?/gi,
  },
  {
    type: 'jwt_token',
    // JWT: three base64url segments separated by dots
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
];

/** The masking placeholder used when redacting sensitive values. */
const MASK_VALUE = '***REDACTED***';

/**
 * Validate a string of digits against the Luhn checksum algorithm.
 *
 * Used to distinguish real credit-card numbers from arbitrary digit runs
 * so that non-card numbers are not mass-redacted as credit cards.
 *
 * @param digits - A string containing only ASCII digits.
 * @returns `true` if the digit sequence passes the Luhn check.
 */
function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) {
    return false;
  }

  let sum = 0;
  let double = false;
  // Process digits right-to-left.
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48; // '0' === 48
    if (double) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }
    sum += d;
    double = !double;
  }

  return sum % 10 === 0;
}

const logger = createLogger({ context: { module: 'governance' } });

// ---------------------------------------------------------------------------
// GovernanceFilter
// ---------------------------------------------------------------------------

/**
 * Applies data governance rules during collection — masking fields,
 * excluding paths, detecting PII, and writing audit logs.
 *
 * @example
 * ```ts
 * const filter = new GovernanceFilter({
 *   masked_fields: ['password', 'token'],
 *   excluded_patterns: ['*.env', 'secrets/**'],
 *   pii_detection: true,
 *   audit_log: true,
 *   retention_days: 90,
 * });
 *
 * const clean = filter.maskEntity(rawEntity);
 * ```
 */
export class GovernanceFilter {
  private readonly config: DataGovernance;
  private readonly auditEntries: AuditEntry[] = [];

  /**
   * @param config - Data governance configuration.
   */
  constructor(config: DataGovernance) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Entity Masking
  // -----------------------------------------------------------------------

  /**
   * Apply property-level masking to an entity based on the configured
   * `masked_fields` list.
   *
   * Returns a *shallow clone* of the entity with masked properties;
   * the original is not mutated.
   *
   * @param entity - The entity to mask.
   * @returns A new entity with sensitive properties replaced by `***REDACTED***`.
   */
  maskEntity(entity: Entity): Entity {
    const maskedProps: Record<string, unknown> = { ...entity.properties };

    for (const field of this.config.masked_fields) {
      if (field in maskedProps) {
        maskedProps[field] = MASK_VALUE;
      }
    }

    if (this.config.pii_detection) {
      for (const [key, value] of Object.entries(maskedProps)) {
        // Recurse into nested objects/arrays so PII buried in nested
        // structures is sanitized too, not just top-level strings.
        maskedProps[key] = this.sanitizeValue(value);
      }
    }

    const masked: Entity = {
      ...entity,
      properties: maskedProps,
    };

    // createAuditEntry is the single place that appends to auditEntries
    // (and it internally respects the audit_log flag), so call it directly
    // rather than pushing its return value ourselves — otherwise each mask
    // would be logged twice.
    this.createAuditEntry('mask_entity', {
      entity_id: entity.id,
      entity_type: entity.type,
      masked_fields: this.config.masked_fields.filter((f) => f in entity.properties),
    });

    return masked;
  }

  /**
   * Recursively sanitize a value for PII.
   *
   * - Strings are passed through {@link sanitizeText}.
   * - Arrays are mapped element-wise.
   * - Plain objects have each entry recursed into.
   * - All other primitives are returned unchanged.
   *
   * @param value - The value to sanitize.
   * @returns The sanitized value (a new structure for arrays/objects).
   */
  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.sanitizeText(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.sanitizeValue(val);
      }
      return result;
    }

    return value;
  }

  // -----------------------------------------------------------------------
  // Path Exclusion
  // -----------------------------------------------------------------------

  /**
   * Check whether a file path matches any of the configured exclusion
   * glob patterns.
   *
   * Uses a simple glob-to-regex conversion supporting `*`, `**`, and `?`.
   *
   * @param path - The file path to check.
   * @returns `true` if the path should be excluded.
   */
  isExcluded(path: string): boolean {
    const normalizedPath = path.replace(/\\/g, '/');

    for (const pattern of this.config.excluded_patterns) {
      if (this.globMatch(normalizedPath, pattern)) {
        return true;
      }
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // PII Detection
  // -----------------------------------------------------------------------

  /**
   * Detect PII instances within a text string using regex patterns.
   *
   * Scans for: emails, phone numbers, SSNs, credit card numbers,
   * IP addresses, API keys, and JWT tokens.
   *
   * @param text - The text to scan.
   * @returns Array of detected PII matches.
   */
  detectPII(text: string): PIIDetection[] {
    if (!this.config.pii_detection) {
      return [];
    }

    const detections: PIIDetection[] = [];

    for (const { type, pattern } of PII_PATTERNS) {
      // Reset the global regex state before each scan
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        // credit_card matches are noisy: the pattern matches any run of
        // 13-19ish digits. Only treat a match as a credit card if it passes
        // the Luhn checksum, otherwise arbitrary numbers get mass-redacted.
        if (type === 'credit_card') {
          const digits = match[0].replace(/[-\s]/g, '');
          if (digits.length < 13 || digits.length > 19 || !isValidLuhn(digits)) {
            continue;
          }
        }

        detections.push({
          type,
          match: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    return detections;
  }

  /**
   * Remove all detected PII from a text string, replacing each
   * occurrence with the `[REDACTED:<type>]` placeholder.
   *
   * @param text - The text to sanitize.
   * @returns Sanitized text with PII replaced.
   */
  sanitizeText(text: string): string {
    if (!this.config.pii_detection) {
      return text;
    }

    let sanitized = text;

    // detectPII scans each pattern independently, so matches from different
    // patterns can overlap (e.g. a phone number embedded in a credit-card
    // match). Splicing overlapping ranges independently double-splices and
    // can leak partial PII. Merge overlapping/adjacent ranges first so each
    // character range is redacted exactly once.
    const merged = this.mergeDetections(this.detectPII(text));

    // Process merged spans in reverse order so indices remain valid as we splice.
    const ordered = merged.sort((a, b) => b.start - a.start);

    for (const span of ordered) {
      sanitized =
        sanitized.slice(0, span.start) +
        `[REDACTED:${span.type}]` +
        sanitized.slice(span.end);
    }

    return sanitized;
  }

  /**
   * Merge overlapping or adjacent PII detections into non-overlapping spans.
   *
   * When two detections overlap, they are combined into a single redaction
   * span that adopts the type of the earliest (left-most) detection. This
   * guarantees no character range is redacted twice and no partial PII is
   * left behind between two overlapping matches.
   *
   * @param detections - Raw detections (possibly overlapping).
   * @returns Non-overlapping detection spans sorted by ascending start index.
   */
  private mergeDetections(detections: PIIDetection[]): PIIDetection[] {
    if (detections.length <= 1) {
      return [...detections];
    }

    const sorted = [...detections].sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: PIIDetection[] = [];

    for (const detection of sorted) {
      const last = merged[merged.length - 1];

      // Overlapping or adjacent (touching) ranges are merged into `last`.
      // `last.type` retains the left-most detection's type.
      if (last && detection.start <= last.end) {
        if (detection.end > last.end) {
          last.end = detection.end;
        }
      } else {
        merged.push({ ...detection });
      }
    }

    return merged;
  }

  // -----------------------------------------------------------------------
  // Audit Logging
  // -----------------------------------------------------------------------

  /**
   * Create a new audit log entry.
   *
   * @param action - The action being audited (e.g. `'mask_entity'`).
   * @param details - Structured details about the event.
   * @returns The created audit entry.
   */
  createAuditEntry(action: string, details: Record<string, unknown>): AuditEntry {
    const entry: AuditEntry = {
      timestamp: nowISO(),
      action,
      details,
    };

    if (this.config.audit_log) {
      this.auditEntries.push(entry);
      logger.debug('Audit entry created', { action, details });
    }

    return entry;
  }

  /**
   * Retrieve all accumulated audit entries.
   *
   * @returns A snapshot of all audit entries.
   */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return [...this.auditEntries];
  }

  /**
   * Clear the in-memory audit log.
   */
  clearAuditLog(): void {
    this.auditEntries.length = 0;
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /**
   * Simple glob matching supporting `*`, `**`, and `?` wildcards.
   *
   * @param path - The path to test.
   * @param pattern - The glob pattern to match against.
   * @returns `true` if the path matches the pattern.
   */
  private globMatch(path: string, pattern: string): boolean {
    // Escape regex special chars except glob wildcards
    let regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    // Replace ** with a temp token, then single *, then restore **
    regexStr = regexStr.replace(/\*\*/g, '{{GLOBSTAR}}');
    regexStr = regexStr.replace(/\*/g, '[^/]*');
    regexStr = regexStr.replace(/{{GLOBSTAR}}/g, '.*');
    regexStr = regexStr.replace(/\?/g, '[^/]');

    const regex = new RegExp(`^${regexStr}$`);
    // Test both the full path and basename
    const basename = path.split('/').pop() ?? path;
    return regex.test(path) || regex.test(basename);
  }
}
