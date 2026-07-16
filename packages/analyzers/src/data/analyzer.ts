/**
 * @module @recurrsive/analyzers/data
 *
 * Data analyzer — examines database-related entities in the knowledge
 * graph to detect schema anti-patterns, missing indexes, unused tables,
 * wide tables, missing timestamps, and inconsistent naming conventions.
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

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of columns before a table is flagged as "wide". */
const WIDE_TABLE_THRESHOLD = 20;

/** Regex for snake_case convention. */
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** Regex for camelCase convention. */
const CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*$/;

/** Regex for PascalCase convention. */
const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/;

/** Standard timestamp columns expected on every table. */
export const EXPECTED_TIMESTAMPS = ['created_at', 'updated_at'];

// ─── Analyzer ─────────────────────────────────────────────────────────────────

/**
 * Analyzes database-related entities in the knowledge graph for schema
 * and data access anti-patterns.
 *
 * ### Rules
 * 1. **Schema anti-patterns** — tables without primary keys.
 * 2. **Wide tables** — tables with more than 20 property columns.
 * 3. **Missing timestamps** — tables without `created_at` / `updated_at`.
 * 4. **Inconsistent naming** — mixed naming conventions across tables.
 *
 * ### Removed rules (producer/consumer contract mismatch)
 * - "Missing indexes" required `index` and `query` entities that no collector
 *   produces, so it could never fire.
 * - "Unused tables" required `queries_table`/`reads_from`/`writes_to` usage
 *   relationships that are never produced; it therefore flagged every table
 *   not on the receiving end of a foreign key as "unused" — a systematic false
 *   positive.
 * - The "missing foreign keys" sub-check of schema anti-patterns was removed:
 *   the database collector only creates a `references` relationship for columns
 *   that *are* foreign keys, so "references another table but has no foreign
 *   key" was contradictory and always false-positived (it read
 *   `has_foreign_keys`, which is never set).
 *
 * @example
 * ```ts
 * const analyzer = new DataAnalyzer();
 * await analyzer.initialize(ctx);
 * const findings = await analyzer.analyze(ctx);
 * ```
 */
export class DataAnalyzer implements Analyzer {
  readonly id = 'data.schema-quality';
  readonly name = 'Data Analyzer';
  readonly description =
    'Detects database schema anti-patterns, missing indexes, unused tables, wide tables, missing timestamps, and inconsistent naming conventions.';
  readonly version = '0.1.0';
  readonly categories = ['data' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      schemaAntiPatterns,
      wideTables,
      missingTimestamps,
      inconsistentNaming,
    ] = await Promise.all([
      this.detectSchemaAntiPatterns(ctx),
      this.detectWideTables(ctx),
      this.detectMissingTimestamps(ctx),
      this.detectInconsistentNaming(ctx),
    ]);

    findings.push(
      ...schemaAntiPatterns,
      ...wideTables,
      ...missingTimestamps,
      ...inconsistentNaming,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const tables = await ctx.graph.getEntities('table');

      // Detect distinct databases by grouping tables by their database property/tag
      const databaseNames = new Set<string>();
      for (const table of tables) {
        const dbName =
          (table.properties['database'] as string | undefined) ??
          (table.properties['schema'] as string | undefined);
        if (dbName) databaseNames.add(dbName);
      }

      if (tables.length > 0) {
        // Cross-cutting check: tables exist but no migration files detected
        const files = await ctx.graph.getEntities('file');
        const migrationFiles = files.filter(
          (f) =>
            /migrat/i.test(f.name) ||
            (f.properties['directory'] as string | undefined ?? '').includes('migration') ||
            f.tags.includes('migration') ||
            f.tags.includes('schema-migration'),
        );

        if (migrationFiles.length === 0) {
          findings.push(
            createFinding({
              title: 'Database schema without migration management',
              description:
                `The project has ${tables.length} database table(s) but no migration files ` +
                `were found. Database schema changes should be tracked with versioned migrations ` +
                `to ensure reproducible deployments and safe rollbacks.`,
              severity: 'medium',
              category: 'data',
              analyzer_id: this.id,
              evidence: [
                createEvidence({
                  type: 'metric',
                  source: 'data.cross-cutting',
                  description: `${tables.length} table(s), 0 migration files`,
                  entity_ids: tables.slice(0, 10).map((t) => t.id),
                  confidence: 0.85,
                  data: {
                    table_count: tables.length,
                    migration_file_count: 0,
                  },
                }),
              ],
              locations: [],
              suggested_fix:
                'Adopt a migration tool (Prisma Migrate, Knex migrations, Flyway, Alembic, or golang-migrate). Version all schema changes as migration files committed to source control.',
              confidence: 0.8,
              tags: ['no-migrations', 'data', 'schema-management', 'deployment'],
            }),
          );
        }

        // Cross-cutting check: multiple databases without cross-database relationships
        if (databaseNames.size > 2) {
          // Group tables by database
          const dbTableMap = new Map<string, Entity[]>();
          for (const table of tables) {
            const dbName =
              (table.properties['database'] as string | undefined) ??
              (table.properties['schema'] as string | undefined) ??
              'default';
            const list = dbTableMap.get(dbName) ?? [];
            list.push(table);
            dbTableMap.set(dbName, list);
          }

          // Check if any cross-database relationships exist
          let hasCrossDbRelationship = false;
          for (const [_dbName, dbTables] of dbTableMap) {
            const dbTableIds = new Set(dbTables.map((t) => t.id));
            for (const table of dbTables) {
              const outRels = await ctx.graph.getRelationships(table.id, 'out');
              const crossDb = outRels.some(
                (r) => r.type === 'references' && !dbTableIds.has(r.target_id),
              );
              if (crossDb) {
                hasCrossDbRelationship = true;
                break;
              }
            }
            if (hasCrossDbRelationship) break;
          }

          if (!hasCrossDbRelationship) {
            const dbNamesList = [...databaseNames];
            findings.push(
              createFinding({
                title: 'Multiple databases without documented relationships',
                description:
                  `The project uses ${databaseNames.size} databases (${dbNamesList.join(', ')}) ` +
                  `but no cross-database relationships are documented in the knowledge graph. ` +
                  `When multiple data stores coexist, their boundaries, data flow, and consistency ` +
                  `guarantees should be explicitly mapped.`,
                severity: 'low',
                category: 'data',
                analyzer_id: this.id,
                evidence: [
                  createEvidence({
                    type: 'metric',
                    source: 'data.cross-cutting',
                    description: `${databaseNames.size} databases with no cross-database relationships`,
                    entity_ids: tables.slice(0, 10).map((t) => t.id),
                    confidence: 0.7,
                    data: {
                      database_count: databaseNames.size,
                      database_names: dbNamesList,
                    },
                  }),
                ],
                locations: [],
                suggested_fix:
                  'Document the data flow between databases. Create an architecture diagram showing which services own which databases and how data is synchronized or replicated.',
                confidence: 0.65,
                tags: ['multi-database', 'data', 'architecture', 'data-flow'],
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

  // ── Rule 1: Schema Anti-Patterns ────────────────────────────────────

  /**
   * Detect tables without primary keys.
   *
   * The database collector populates `has_primary_key` from parsed schema
   * definitions, so this rule evaluates real data. The former "missing foreign
   * keys" sub-check was removed because the collector only produces a
   * `references` relationship for columns that are foreign keys, making the
   * check self-contradictory (and it read `has_foreign_keys`, never set).
   *
   * @param ctx - Analysis context.
   * @returns Findings for schema anti-patterns.
   */
  private async detectSchemaAntiPatterns(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const tables = await ctx.graph.getEntities('table');

    for (const table of tables) {
      // Check for missing primary key
      const hasPrimaryKey =
        table.properties['has_primary_key'] === true ||
        table.properties['primary_key'] != null ||
        table.tags.includes('has-primary-key');

      if (!hasPrimaryKey) {
        const loc = locationFromEntity(table);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Table without primary key: ${table.name}`,
            description: `Table '${table.name}' does not appear to have a primary key. Every table should have a primary key for data integrity and efficient querying.`,
            severity: 'high',
            category: 'data',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'No primary key detected on table schema',
                entity_ids: [table.id],
                confidence: 0.85,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Add a primary key to table '${table.name}'. Use a UUID or auto-incrementing integer, depending on your distribution and scaling needs.`,
            confidence: 0.8,
            tags: ['no-primary-key', 'data', 'schema-anti-pattern'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: Wide Tables ─────────────────────────────────────────────

  /**
   * Detect tables with too many columns (> WIDE_TABLE_THRESHOLD).
   *
   * @param ctx - Analysis context.
   * @returns Findings for wide tables.
   */
  private async detectWideTables(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const tables = await ctx.graph.getEntities('table');

    for (const table of tables) {
      const columns = table.properties['columns'] as unknown[] | undefined;
      const columnCount =
        (table.properties['column_count'] as number | undefined) ??
        columns?.length ??
        0;

      if (columnCount > WIDE_TABLE_THRESHOLD) {
        const loc = locationFromEntity(table);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Wide table: ${table.name} (${columnCount} columns)`,
            description: `Table '${table.name}' has ${columnCount} columns, exceeding the recommended maximum of ${WIDE_TABLE_THRESHOLD}. Wide tables often indicate a missing normalization step or a "God table" anti-pattern.`,
            severity: 'medium',
            category: 'data',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `${columnCount} columns detected (threshold: ${WIDE_TABLE_THRESHOLD})`,
                entity_ids: [table.id],
                confidence: 0.9,
                data: { column_count: columnCount, threshold: WIDE_TABLE_THRESHOLD },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Consider normalizing table '${table.name}' into smaller, focused tables. Group related columns into separate tables with foreign key references. Use JSON columns for truly dynamic attributes.`,
            confidence: 0.85,
            tags: ['wide-table', 'data', 'normalization', 'schema-anti-pattern'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Missing Timestamps ──────────────────────────────────────

  /**
   * Detect tables without standard `created_at` / `updated_at` columns.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing timestamps.
   */
  private async detectMissingTimestamps(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const tables = await ctx.graph.getEntities('table');

    for (const table of tables) {
      const columns = table.properties['columns'] as
        | Array<{ name: string }>
        | string[]
        | undefined;
      const columnNames = columns
        ? columns.map((c) => (typeof c === 'string' ? c : c.name).toLowerCase())
        : [];

      // Also check properties directly
      const hasCreatedAt =
        table.properties['has_created_at'] === true ||
        columnNames.some((n) => n === 'created_at' || n === 'createdat' || n === 'created');
      const hasUpdatedAt =
        table.properties['has_updated_at'] === true ||
        columnNames.some((n) => n === 'updated_at' || n === 'updatedat' || n === 'updated' || n === 'modified_at');

      const missingTimestamps: string[] = [];
      if (!hasCreatedAt) missingTimestamps.push('created_at');
      if (!hasUpdatedAt) missingTimestamps.push('updated_at');

      // Only report if columns are known (non-empty columnNames or explicit properties)
      if (
        missingTimestamps.length > 0 &&
        (columnNames.length > 0 ||
          table.properties['has_created_at'] != null ||
          table.properties['has_updated_at'] != null)
      ) {
        const loc = locationFromEntity(table);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing timestamps: ${table.name}`,
            description: `Table '${table.name}' is missing timestamp columns: ${missingTimestamps.join(', ')}. Audit logging, debugging, and data reconciliation require knowing when rows were created and last modified.`,
            severity: 'low',
            category: 'data',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Missing columns: ${missingTimestamps.join(', ')}`,
                entity_ids: [table.id],
                confidence: 0.75,
                data: { missing_timestamps: missingTimestamps },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Add ${missingTimestamps.map((t) => `\`${t}\``).join(' and ')} columns to table '${table.name}'. Use database defaults (e.g., \`DEFAULT NOW()\`) and triggers for automatic updates.`,
            confidence: 0.7,
            tags: ['missing-timestamps', 'data', 'audit'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 4: Inconsistent Naming ─────────────────────────────────────

  /**
   * Detect inconsistent naming conventions across tables (e.g. mixing
   * snake_case and camelCase).
   *
   * @param ctx - Analysis context.
   * @returns Findings for inconsistent naming.
   */
  private async detectInconsistentNaming(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const tables = await ctx.graph.getEntities('table');

    if (tables.length < 2) return findings;

    // Categorize each table name
    const conventions: Record<string, Entity[]> = {
      snake_case: [],
      camelCase: [],
      PascalCase: [],
      other: [],
    };

    for (const table of tables) {
      if (SNAKE_CASE_RE.test(table.name)) {
        conventions['snake_case']!.push(table);
      } else if (PASCAL_CASE_RE.test(table.name)) {
        conventions['PascalCase']!.push(table);
      } else if (CAMEL_CASE_RE.test(table.name)) {
        conventions['camelCase']!.push(table);
      } else {
        conventions['other']!.push(table);
      }
    }

    // Find the dominant convention
    const sorted = Object.entries(conventions)
      .filter(([, v]) => v.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    if (sorted.length <= 1) return findings;

    const [dominant, ...minorities] = sorted;
    if (!dominant) return findings;

    const dominantConvention = dominant[0];
    const outlierTables = minorities.flatMap(([convention, tables]) =>
      tables.map((t) => ({ table: t, convention })),
    );

    if (outlierTables.length > 0) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: `Inconsistent table naming convention`,
          description: `The dominant naming convention is ${dominantConvention} (${dominant[1].length} tables), but ${outlierTables.length} table(s) use different conventions: ${outlierTables.map((o) => `'${o.table.name}' (${o.convention})`).join(', ')}. Consistent naming improves discoverability and reduces cognitive load.`,
          severity: 'info',
          category: 'data',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${outlierTables.length} tables deviate from ${dominantConvention} convention`,
              entity_ids: outlierTables.map((o) => o.table.id),
              confidence: 0.8,
              data: {
                dominant_convention: dominantConvention,
                outliers: outlierTables.map((o) => ({
                  name: o.table.name,
                  convention: o.convention,
                })),
              },
            }),
          ],
          locations: [],
          suggested_fix: `Rename outlier tables to use the ${dominantConvention} convention. Create migrations to rename them and update all references in application code.`,
          confidence: 0.75,
          tags: ['naming-convention', 'data', 'consistency'],
        }),
      );
    }

    return findings;
  }
}
