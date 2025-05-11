import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../../../db-helper';
import { sql } from '../../../sql-string';

interface TestSchema {
  id: string;
  email: string;
  status: string;
}

describe('Index Creation', () => {
  const testSym = createDbDiscriminator('test');
  const db = createDb({
    query: async () => [],
    runQueriesInTransaction: async () => {},
    discriminator: testSym,
    getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
  });

  it('creates basic index with required fields', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_email: index(table.email),
      }))
      .build();

    const emailIndex = table.indexes.idx_email;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      // Required fields
      expect(emailIndex.name).toBe('users_idx_email');
      expect(emailIndex.table).toBe('users');
      expect(emailIndex.schema).toBe('public');
      expect(emailIndex.expressions).toHaveLength(1);

      // Fields with defaults
      expect(emailIndex.unique).toBe(false);
      expect(emailIndex.concurrently).toBe(false);
      expect(emailIndex.ifNotExists).toBe(false);
      expect(emailIndex.nullsNotDistinct).toBe(false);

      // Optional fields should be undefined
      expect(emailIndex.method).toBeUndefined();
      expect(emailIndex.ascending).toBeUndefined();
      expect(emailIndex.storingColumns).toEqual([]);
      expect(emailIndex.withClause).toBeUndefined();
      expect(emailIndex.storageParameters).toBeUndefined();
      expect(emailIndex.whereClause).toBeUndefined();
      expect(emailIndex.previousState).toBeUndefined();
    }
  });

  it('creates unique index with custom options', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_unique_email: index(table.email)
          .unique()
          .where(table.status.equals('active')),
      }))
      .build();

    const emailIndex = table.indexes.idx_unique_email;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      // Required fields
      expect(emailIndex.name).toBe('users_idx_unique_email');
      expect(emailIndex.table).toBe('users');
      expect(emailIndex.schema).toBe('public');
      expect(emailIndex.expressions).toHaveLength(1);

      // Fields with defaults - unique overridden
      expect(emailIndex.unique).toBe(true);
      expect(emailIndex.concurrently).toBe(false);
      expect(emailIndex.ifNotExists).toBe(false);
      expect(emailIndex.nullsNotDistinct).toBe(false);

      // Where clause should be set
      expect(emailIndex.whereClause).toBeDefined();
    }
  });

  it('creates composite index with storing columns', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_email_status: index(table.email, table.status).storing(table.id),
      }))
      .build();

    const compositeIndex = table.indexes.idx_email_status;
    expect(compositeIndex).toBeDefined();
    if (compositeIndex) {
      // Required fields
      expect(compositeIndex.name).toBe('users_idx_email_status');
      expect(compositeIndex.table).toBe('users');
      expect(compositeIndex.schema).toBe('public');
      expect(compositeIndex.expressions).toHaveLength(2);

      // Fields with defaults
      expect(compositeIndex.unique).toBe(false);
      expect(compositeIndex.concurrently).toBe(false);
      expect(compositeIndex.ifNotExists).toBe(false);
      expect(compositeIndex.nullsNotDistinct).toBe(false);

      // Storing columns should be set
      expect(compositeIndex.storingColumns).toHaveLength(1);
    }
  });

  it('creates index with expression', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
      })
      .primaryKey('id')
      .indexes(({ table: _, index }) => ({
        idx_lower_email: index(
          sql.__dangerouslyConstructRawSql('lower(email)')
        ),
      }))
      .build();

    const expressionIndex = table.indexes.idx_lower_email;
    expect(expressionIndex).toBeDefined();
    if (expressionIndex) {
      // Required fields
      expect(expressionIndex.name).toBe('users_idx_lower_email');
      expect(expressionIndex.table).toBe('users');
      expect(expressionIndex.schema).toBe('public');
      expect(expressionIndex.expressions).toHaveLength(1);
      expect(expressionIndex.expressions[0].getQuery()).toBe('lower(email)');

      // Fields with defaults
      expect(expressionIndex.unique).toBe(false);
      expect(expressionIndex.concurrently).toBe(false);
      expect(expressionIndex.ifNotExists).toBe(false);
      expect(expressionIndex.nullsNotDistinct).toBe(false);
    }
  });

  it('creates index in custom schema', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .schema('custom')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_email: index(table.email),
      }))
      .build();

    const emailIndex = table.indexes.idx_email;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      // Required fields
      expect(emailIndex.name).toBe('users_idx_email');
      expect(emailIndex.table).toBe('users');
      expect(emailIndex.schema).toBe('custom');
      expect(emailIndex.expressions).toHaveLength(1);

      // Fields with defaults
      expect(emailIndex.unique).toBe(false);
      expect(emailIndex.concurrently).toBe(false);
      expect(emailIndex.ifNotExists).toBe(false);
      expect(emailIndex.nullsNotDistinct).toBe(false);
    }
  });
});
