import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../../../db-helper';
import { sql } from '../../../sql-string';
import { createIndex } from '../create-index';

interface TestSchema {
  id: string;
  email: string;
  status: string;
}

const testSym = createDbDiscriminator('test');
const db = createDb({
  query: async () => [],
  runQueriesInTransaction: async () => {},
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

describe('Index Creation', () => {
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
      expect(emailIndex.inverted).toBe(false);

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

  it('creates index with descending column', () => {
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
        idx_email_desc: index(table.email.desc()),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_desc;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.name).toBe('users_idx_email_desc');
      expect(emailIndex.table).toBe('users');
      expect(emailIndex.schema).toBe('public');
      expect(emailIndex.expressions).toHaveLength(1);

      // Check ascending array - should be [false] for DESC
      expect(emailIndex.ascending).toEqual([false]);

      expect(emailIndex.unique).toBe(false);
    }
  });

  it('creates index with ascending column', () => {
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
        idx_email_asc: index(table.email.asc()),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_asc;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.name).toBe('users_idx_email_asc');
      expect(emailIndex.table).toBe('users');
      expect(emailIndex.schema).toBe('public');
      expect(emailIndex.expressions).toHaveLength(1);

      // Check ascending array - should be [true] for ASC
      expect(emailIndex.ascending).toEqual([true]);

      expect(emailIndex.unique).toBe(false);
    }
  });

  it('creates composite index with mixed directions', () => {
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
        idx_email_status_mixed: index(table.email.asc(), table.status.desc()),
      }))
      .build();

    const compositeIndex = table.indexes.idx_email_status_mixed;
    expect(compositeIndex).toBeDefined();
    if (compositeIndex) {
      expect(compositeIndex.name).toBe('users_idx_email_status_mixed');
      expect(compositeIndex.table).toBe('users');
      expect(compositeIndex.schema).toBe('public');
      expect(compositeIndex.expressions).toHaveLength(2);

      // Check ascending array - should be [true, false] for ASC, DESC
      expect(compositeIndex.ascending).toEqual([true, false]);

      expect(compositeIndex.unique).toBe(false);
    }
  });

  it('creates composite index with some columns without explicit direction', () => {
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
        idx_mixed: index(table.email, table.status.desc()),
      }))
      .build();

    const compositeIndex = table.indexes.idx_mixed;
    expect(compositeIndex).toBeDefined();
    if (compositeIndex) {
      expect(compositeIndex.name).toBe('users_idx_mixed');
      expect(compositeIndex.table).toBe('users');
      expect(compositeIndex.schema).toBe('public');
      expect(compositeIndex.expressions).toHaveLength(2);

      // Check ascending array - should be [true, false] for default ASC, explicit DESC
      expect(compositeIndex.ascending).toEqual([true, false]);

      expect(compositeIndex.unique).toBe(false);
    }
  });

  it('creates index with desc and storing columns', () => {
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
        idx_email_desc_storing: index(table.email.desc()).storing(table.status),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_desc_storing;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.name).toBe('users_idx_email_desc_storing');
      expect(emailIndex.table).toBe('users');
      expect(emailIndex.schema).toBe('public');
      expect(emailIndex.expressions).toHaveLength(1);

      // Check ascending array - should be [false] for DESC
      expect(emailIndex.ascending).toEqual([false]);

      // Check storing columns
      expect(emailIndex.storingColumns).toHaveLength(1);
      expect(emailIndex.storingColumns).toContain('status');

      expect(emailIndex.unique).toBe(false);
    }
  });
});

describe('Index SQL Generation', () => {
  it('generates SQL with DESC keyword for descending index', () => {
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
        idx_email_desc: index(table.email.desc()),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_desc;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      // Should contain DESC keyword
      expect(sqlString).toContain('DESC');
      expect(sqlString).toMatch(
        /CREATE INDEX "users_idx_email_desc" ON "public"\."users" \("email" DESC\)/
      );
    }
  });

  it('generates SQL with mixed ASC/DESC for composite index', () => {
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
        idx_composite: index(table.email.asc(), table.status.desc()),
      }))
      .build();

    const compositeIndex = table.indexes.idx_composite;
    expect(compositeIndex).toBeDefined();
    if (compositeIndex) {
      const indexSql = createIndex(compositeIndex);
      const sqlString = indexSql.getQuery();

      // Should contain DESC keyword for second column only
      expect(sqlString).toContain('DESC');
      expect(sqlString).toMatch(/"email", "status" DESC/);
    }
  });

  it('generates SQL without DESC for ascending index', () => {
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
        idx_email_asc: index(table.email.asc()),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_asc;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      // Should NOT contain DESC keyword (ASC is implicit)
      expect(sqlString).not.toContain('DESC');
      // Note: PostgreSQL doesn't require explicit ASC keyword as it's the default
      expect(sqlString).toMatch(
        /CREATE INDEX "users_idx_email_asc" ON "public"\."users" \("email"\)/
      );
    }
  });

  it('generates SQL without direction keywords for index without explicit direction', () => {
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
      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      // Should NOT contain DESC or ASC keywords
      expect(sqlString).not.toContain('DESC');
      expect(sqlString).not.toContain('ASC');
      expect(sqlString).toMatch(
        /CREATE INDEX "users_idx_email" ON "public"\."users" \("email"\)/
      );
    }
  });

  it('generates SQL with INVERTED keyword for inverted index', () => {
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
        idx_email_inverted: index(table.email).inverted(),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_inverted;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.inverted).toBe(true);

      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      // Should contain INVERTED keyword
      expect(sqlString).toContain('INVERTED');
      expect(sqlString).toMatch(
        /CREATE INVERTED INDEX "users_idx_email_inverted" ON "public"\."users" \("email"\)/
      );
    }
  });

  it('generates SQL with UNIQUE INVERTED for unique inverted index', () => {
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
        idx_email_unique_inverted: index(table.email).unique().inverted(),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_unique_inverted;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.inverted).toBe(true);
      expect(emailIndex.unique).toBe(true);

      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      // Should contain both UNIQUE and INVERTED keywords
      expect(sqlString).toContain('UNIQUE');
      expect(sqlString).toContain('INVERTED');
      expect(sqlString).toMatch(
        /CREATE UNIQUE INVERTED INDEX "users_idx_email_unique_inverted" ON "public"\."users" \("email"\)/
      );
    }
  });

  it('generates SQL with operator class', () => {
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
        idx_email_trgm: index(table.email).operatorClass('gin_trgm_ops'),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_trgm;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.operatorClass).toBe('gin_trgm_ops');

      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      expect(sqlString).toMatch(
        /CREATE INDEX "users_idx_email_trgm" ON "public"\."users" \("email" gin_trgm_ops\)/
      );
    }
  });

  it('generates SQL with operator class and INVERTED', () => {
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
        idx_email_inverted_trgm: index(table.email)
          .inverted()
          .operatorClass('gin_trgm_ops'),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_inverted_trgm;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.inverted).toBe(true);
      expect(emailIndex.operatorClass).toBe('gin_trgm_ops');

      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      expect(sqlString).toContain('INVERTED');
      expect(sqlString).toContain('gin_trgm_ops');
      expect(sqlString).toMatch(
        /CREATE INVERTED INDEX "users_idx_email_inverted_trgm" ON "public"\."users" \("email" gin_trgm_ops\)/
      );
    }
  });

  it('generates SQL with a GIN trigram index', () => {
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
        idx_email_gin_trgm: index(table.email)
          .using('gin')
          .operatorClass('gin_trgm_ops'),
      }))
      .build();

    const emailIndex = table.indexes.idx_email_gin_trgm;
    expect(emailIndex).toBeDefined();
    if (emailIndex) {
      expect(emailIndex.operatorClass).toBe('gin_trgm_ops');
      expect(emailIndex.method).toBe('gin');

      const indexSql = createIndex(emailIndex);
      const sqlString = indexSql.getQuery();

      expect(sqlString).toContain('USING gin');
      expect(sqlString).toContain('gin_trgm_ops');
      expect(sqlString).toMatch(
        /CREATE INDEX "users_idx_email_gin_trgm" ON "public"\."users" USING gin \("email" gin_trgm_ops\)/
      );
    }
  });

  it('generates SQL with operator class on multi-column index', () => {
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
        idx_multi_trgm: index(table.email, table.status)
          .inverted()
          .operatorClass('gin_trgm_ops'),
      }))
      .build();

    const multiIndex = table.indexes.idx_multi_trgm;
    expect(multiIndex).toBeDefined();
    if (multiIndex) {
      expect(multiIndex.operatorClass).toBe('gin_trgm_ops');
      expect(multiIndex.expressions).toHaveLength(2);

      const indexSql = createIndex(multiIndex);
      const sqlString = indexSql.getQuery();

      // Operator class should be applied to all columns
      expect(sqlString).toContain('CREATE INVERTED INDEX');
      expect(sqlString).toMatch(
        /\("email" gin_trgm_ops, "status" gin_trgm_ops\)/
      );
    }
  });
});
