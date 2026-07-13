import { afterEach, describe, expect, it } from 'vitest';
import { assertProductionPersistenceConfig } from '../production-config.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('assertProductionPersistenceConfig', () => {
  it('does not constrain non-production processes', () => {
    process.env['NODE_ENV'] = 'test';
    delete process.env['DATABASE_URL'];
    expect(assertProductionPersistenceConfig).not.toThrow();
  });

  it('requires a database URL in production', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['DATABASE_URL'];
    expect(assertProductionPersistenceConfig).toThrow(/DATABASE_URL must be configured/);
  });

  it('rejects placeholder database credentials', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://recurrsive:change-me@postgres:5432/recurrsive';
    expect(assertProductionPersistenceConfig).toThrow(/placeholder password/);
  });

  it('requires PostgreSQL AGE in production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://recurrsive:a-strong-production-secret@postgres:5432/recurrsive';
    process.env['GRAPH_PROVIDER'] = 'sqlite';
    expect(assertProductionPersistenceConfig).toThrow(/GRAPH_PROVIDER/);
  });

  it('requires an independent secrets encryption key', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://recurrsive:a-strong-production-secret@postgres:5432/recurrsive';
    process.env['GRAPH_PROVIDER'] = 'postgresql_age';
    delete process.env['SECRETS_ENCRYPTION_KEY'];
    expect(assertProductionPersistenceConfig).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });

  it('accepts a valid production persistence configuration', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://recurrsive:a-strong-production-secret@postgres:5432/recurrsive';
    process.env['GRAPH_PROVIDER'] = 'postgresql_age';
    process.env['SECRETS_ENCRYPTION_KEY'] = 'independent-secrets-key-with-32-plus-random-characters';
    process.env['JWT_SECRET'] = 'different-jwt-key-with-32-plus-random-characters';
    expect(assertProductionPersistenceConfig).not.toThrow();
  });
});
