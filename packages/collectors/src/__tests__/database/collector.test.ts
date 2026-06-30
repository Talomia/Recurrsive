/**
 * Tests for the DatabaseCollector.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseCollector } from '../../database/collector.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recurrsive-db-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// SQL Parsing
// ---------------------------------------------------------------------------

describe('SQL schema parsing', () => {
  it('parses CREATE TABLE statements', async () => {
    const sqlDir = path.join(tmpDir, 'sql');
    await fs.mkdir(sqlDir, { recursive: true });

    await fs.writeFile(
      path.join(sqlDir, 'schema.sql'),
      `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`,
    );

    const collector = new DatabaseCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const tables = result.entities.filter((e) => e.type === 'table');
    expect(tables.length).toBe(2);

    const usersTable = tables.find((e) => e.name.includes('users'));
    expect(usersTable).toBeDefined();
    expect(usersTable!.properties['column_count']).toBe(4);
    expect(usersTable!.properties['has_primary_key']).toBe(true);

    const postsTable = tables.find((e) => e.name.includes('posts'));
    expect(postsTable).toBeDefined();
    expect(postsTable!.properties['foreign_key_count']).toBe(1);

    // Should have a foreign key relationship
    const fkRels = result.relationships.filter((r) => r.type === 'references');
    expect(fkRels.length).toBe(1);
    expect(fkRels[0]!.properties['column']).toBe('user_id');

    await collector.dispose();
  });

  it('handles empty project', async () => {
    const collector = new DatabaseCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();
    expect(result.entities.length).toBe(0);

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// Prisma Schema
// ---------------------------------------------------------------------------

describe('Prisma schema parsing', () => {
  it('parses Prisma model definitions', async () => {
    const prismaDir = path.join(tmpDir, 'prisma');
    await fs.mkdir(prismaDir, { recursive: true });

    await fs.writeFile(
      path.join(prismaDir, 'schema.prisma'),
      `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())

  @@index([email])
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  body      String?
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
}
`,
    );

    const collector = new DatabaseCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const tables = result.entities.filter((e) => e.type === 'table');
    expect(tables.length).toBe(2);

    const userTable = tables.find((e) => e.name.includes('User'));
    expect(userTable).toBeDefined();
    expect(userTable!.properties['source']).toBe('prisma');
    expect(userTable!.properties['has_primary_key']).toBe(true);

    const postTable = tables.find((e) => e.name.includes('Post'));
    expect(postTable).toBeDefined();

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// Drizzle Schema
// ---------------------------------------------------------------------------

describe('Drizzle schema parsing', () => {
  it('parses Drizzle table definitions', async () => {
    const schemaDir = path.join(tmpDir, 'src', 'db');
    await fs.mkdir(schemaDir, { recursive: true });

    await fs.writeFile(
      path.join(schemaDir, 'schema.ts'),
      `import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body'),
  userId: integer('user_id').references(() => users.id),
});
`,
    );

    const collector = new DatabaseCollector(tmpDir);
    await collector.initialize({ governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 }, custom: {} });

    const result = await collector.collect();

    const tables = result.entities.filter((e) => e.type === 'table');
    expect(tables.length).toBe(2);

    const usersTable = tables.find((e) => e.name.includes('users'));
    expect(usersTable).toBeDefined();
    expect(usersTable!.properties['source']).toBe('drizzle');

    await collector.dispose();
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('Metadata', () => {
  it('has correct metadata', () => {
    const collector = new DatabaseCollector(tmpDir);
    expect(collector.id).toBe('database');
    expect(collector.name).toBe('Database Schema Collector');
  });

  it('validates paths', async () => {
    const valid = new DatabaseCollector(tmpDir);
    expect((await valid.validate()).valid).toBe(true);

    const invalid = new DatabaseCollector('/nonexistent/42');
    expect((await invalid.validate()).valid).toBe(false);
  });
});
