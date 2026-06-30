/**
 * @module @recurrsive/collectors/database/collector
 *
 * Database Schema Collector — discovers and parses database schema
 * definitions from SQL files, Prisma schemas, and Drizzle ORM schemas.
 *
 * Produces entities:
 * - `table` — database tables
 * - `index` — database indexes
 * - `config` — schema configuration files
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

const logger = createLogger({ context: { module: 'database-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  constraints: string[];
  source: 'sql' | 'prisma' | 'drizzle';
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: string;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Parse CREATE TABLE statements from SQL files.
 */
function parseSQLTables(content: string): TableInfo[] {
  const tables: TableInfo[] = [];
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(([\s\S]*?)\);/gi;

  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1]!;
    const body = match[2]!;
    const columns: ColumnInfo[] = [];
    const constraints: string[] = [];

    const lines = body.split(',').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Skip constraints
      if (/^\s*(PRIMARY KEY|UNIQUE|INDEX|KEY|CONSTRAINT|CHECK|FOREIGN KEY)/i.test(line)) {
        constraints.push(line.trim());
        continue;
      }

      // Parse column definition
      const colMatch = line.match(/["'`]?(\w+)["'`]?\s+(\w+(?:\([^)]*\))?)/i);
      if (colMatch) {
        const colName = colMatch[1]!;
        const colType = colMatch[2]!;

        const isPK = /PRIMARY\s+KEY/i.test(line);
        const isFK = /REFERENCES/i.test(line);
        const nullable = !/NOT\s+NULL/i.test(line);

        let references: string | undefined;
        if (isFK) {
          const refMatch = line.match(/REFERENCES\s+["'`]?(\w+)["'`]?/i);
          if (refMatch) references = refMatch[1];
        }

        columns.push({
          name: colName,
          type: colType.toUpperCase(),
          nullable,
          isPrimaryKey: isPK,
          isForeignKey: isFK,
          references,
        });
      }
    }

    tables.push({
      name: tableName,
      columns,
      constraints,
      source: 'sql',
    });
  }

  return tables;
}

/**
 * Parse Prisma schema model definitions.
 */
function parsePrismaSchema(content: string): TableInfo[] {
  const tables: TableInfo[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;

  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1]!;
    const body = match[2]!;
    const columns: ColumnInfo[] = [];
    const constraints: string[] = [];

    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'));

    // Collect model-level attributes
    const modelAttrs = body.split('\n').filter((l) => l.trim().startsWith('@@'));
    for (const attr of modelAttrs) {
      constraints.push(attr.trim());
    }

    for (const line of lines) {
      if (line.startsWith('@@')) continue;

      // Parse field: name Type modifiers
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?)?(\[\])?/);
      if (!fieldMatch) continue;

      const colName = fieldMatch[1]!;
      const colType = fieldMatch[2]!;
      const isOptional = !!fieldMatch[3];

      const isPK = line.includes('@id');
      const isFK = line.includes('@relation');

      let references: string | undefined;
      if (isFK) {
        const refMatch = line.match(/@relation\(.*references:\s*\[(\w+)\]/);
        if (refMatch) references = refMatch[1];
        // Also check the type itself as a relation target
        if (!references && colType.match(/^[A-Z]/)) {
          references = colType;
        }
      }

      columns.push({
        name: colName,
        type: colType,
        nullable: isOptional,
        isPrimaryKey: isPK,
        isForeignKey: isFK,
        references,
      });
    }

    tables.push({
      name: modelName,
      columns,
      constraints,
      source: 'prisma',
    });
  }

  return tables;
}

/**
 * Parse Drizzle ORM schema files (basic pattern matching).
 */
function parseDrizzleSchema(content: string): TableInfo[] {
  const tables: TableInfo[] = [];

  // Match pgTable, sqliteTable, mysqlTable declarations
  const tableRegex = /(?:pg|sqlite|mysql)Table\s*\(\s*['"](\w+)['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1]!;
    const body = match[2]!;
    const columns: ColumnInfo[] = [];

    // Match column definitions like: name: text('name').notNull()
    const colRegex = /(\w+)\s*:\s*(text|integer|serial|varchar|timestamp|boolean|uuid|bigint|real|jsonb?)\s*\(/g;
    let colMatch;
    while ((colMatch = colRegex.exec(body)) !== null) {
      const colName = colMatch[1]!;
      const colType = colMatch[2]!.toUpperCase();

      // Get the full line for this column for additional checks
      const lineStart = body.lastIndexOf('\n', colMatch.index) + 1;
      const lineEnd = body.indexOf('\n', colMatch.index);
      const fullLine = body.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

      columns.push({
        name: colName,
        type: colType,
        nullable: !fullLine.includes('.notNull()'),
        isPrimaryKey: fullLine.includes('.primaryKey()') || colType === 'SERIAL',
        isForeignKey: fullLine.includes('.references('),
        references: undefined,
      });
    }

    tables.push({
      name: tableName,
      columns,
      constraints: [],
      source: 'drizzle',
    });
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export class DatabaseCollector implements Collector {
  readonly id = 'database';
  readonly name = 'Database Schema Collector';
  readonly description = 'Collects database schemas from SQL, Prisma, and Drizzle ORM definitions.';
  readonly type: CollectorType = 'code';
  readonly version = '0.1.0';

  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async initialize(_config: CollectorConfig): Promise<void> {
    logger.info('Database collector initialized', { rootPath: this.rootPath });
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
      tags: ['database', ...tags],
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
    const allTables: TableInfo[] = [];

    // ── Discover SQL files ────────────────────────────────────────
    const sqlFiles = await this.findSQLFiles();
    for (const sf of sqlFiles) {
      const tables = parseSQLTables(sf.content);
      allTables.push(...tables);
    }

    // ── Discover Prisma schema ────────────────────────────────────
    const prismaFile = await this.findPrismaSchema();
    if (prismaFile) {
      const tables = parsePrismaSchema(prismaFile.content);
      allTables.push(...tables);
    }

    // ── Discover Drizzle schemas ──────────────────────────────────
    const drizzleFiles = await this.findDrizzleSchemas();
    for (const df of drizzleFiles) {
      const tables = parseDrizzleSchema(df.content);
      allTables.push(...tables);
    }

    // ── Build entities and relationships ──────────────────────────
    const tableEntityMap = new Map<string, Entity>();

    for (const table of allTables) {
      const tableEntity = this.makeEntity(
        'table',
        `db.${table.name}`,
        {
          source: table.source,
          column_count: table.columns.length,
          columns: table.columns.map((c) => ({
            name: c.name,
            type: c.type,
            nullable: c.nullable,
            is_primary_key: c.isPrimaryKey,
            is_foreign_key: c.isForeignKey,
          })),
          has_primary_key: table.columns.some((c) => c.isPrimaryKey),
          foreign_key_count: table.columns.filter((c) => c.isForeignKey).length,
          constraint_count: table.constraints.length,
        },
        [table.source, table.name.toLowerCase()],
      );
      entities.push(tableEntity);
      tableEntityMap.set(table.name, tableEntity);
    }

    // Create foreign key relationships
    for (const table of allTables) {
      const tableEntity = tableEntityMap.get(table.name);
      if (!tableEntity) continue;

      for (const col of table.columns) {
        if (col.isForeignKey && col.references) {
          const refEntity = tableEntityMap.get(col.references);
          if (refEntity) {
            relationships.push(this.makeRel(
              'references',
              tableEntity.id,
              refEntity.id,
              { column: col.name, referenced_table: col.references },
            ));
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const itemsProcessed = sqlFiles.length + (prismaFile ? 1 : 0) + drizzleFiles.length;

    logger.info('Database collection complete', {
      entities: entities.length,
      relationships: relationships.length,
      tables: allTables.length,
      durationMs,
    });

    return {
      entities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: itemsProcessed,
        errors: [],
      },
    };
  }

  async dispose(): Promise<void> {
    // No resources to release
  }

  // ── File discovery helpers ─────────────────────────────────────

  private async findSQLFiles(): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    const seen = new Set<string>();
    const searchDirs = [
      this.rootPath,
      path.join(this.rootPath, 'sql'),
      path.join(this.rootPath, 'db'),
      path.join(this.rootPath, 'database'),
      path.join(this.rootPath, 'migrations'),
      path.join(this.rootPath, 'src', 'db'),
      path.join(this.rootPath, 'prisma', 'migrations'),
    ];

    for (const dir of searchDirs) {
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) continue;
        await this.walkForSQL(dir, results, 0, seen);
      } catch {
        // Directory doesn't exist
      }
    }

    return results;
  }

  private async walkForSQL(
    dir: string,
    results: Array<{ path: string; content: string }>,
    depth: number,
    seen: Set<string>,
  ): Promise<void> {
    if (depth > 3) return; // Prevent deep recursion

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await this.walkForSQL(fullPath, results, depth + 1, seen);
      } else if (entry.isFile() && entry.name.endsWith('.sql')) {
        if (seen.has(fullPath)) continue;
        seen.add(fullPath);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          // Only include files that have CREATE TABLE
          if (/CREATE\s+TABLE/i.test(content)) {
            results.push({ path: fullPath, content });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  private async findPrismaSchema(): Promise<{ path: string; content: string } | null> {
    const candidates = [
      path.join(this.rootPath, 'prisma', 'schema.prisma'),
      path.join(this.rootPath, 'schema.prisma'),
    ];

    for (const candidate of candidates) {
      try {
        const content = await fs.readFile(candidate, 'utf-8');
        return { path: candidate, content };
      } catch {
        // File doesn't exist
      }
    }

    return null;
  }

  private async findDrizzleSchemas(): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    const searchDirs = [
      path.join(this.rootPath, 'src', 'db'),
      path.join(this.rootPath, 'src', 'schema'),
      path.join(this.rootPath, 'drizzle'),
      path.join(this.rootPath, 'db'),
    ];

    for (const dir of searchDirs) {
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) continue;

        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js')) continue;
          if (!entry.name.includes('schema')) continue;

          const filePath = path.join(dir, entry.name);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (/(?:pg|sqlite|mysql)Table\s*\(/.test(content)) {
              results.push({ path: filePath, content });
            }
          } catch {
            // Skip unreadable files
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return results;
  }
}
