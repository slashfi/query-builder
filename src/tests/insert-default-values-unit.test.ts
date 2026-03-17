import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';
import { sql } from '../sql-string';

describe('Insert Default Values - Unit Tests', () => {
  const testSym = createDbDiscriminator('test');

  const db = createDb({
    query: async () => [],
    runQueriesInTransaction: async () => {},
    discriminator: testSym,
    getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
  });

  interface TestSchema {
    id: string;
    name: string;
    created_at: Date;
    retry_count: number;
    status: string;
    updated_at: Date | undefined;
  }

  class TestTable {
    static readonly Table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('test_default_values')
      .columns({
        id: (_) => _.varchar(),
        name: (_) => _.varchar(),
        // Column with timestamp default
        created_at: (_) => _.timestamp().default(sql`current_timestamp()`),
        // Column with integer default
        retry_count: (_) => _.int().default(0),
        // Column with string default
        status: (_) => _.varchar().default('pending'),
        // Nullable column without default
        updated_at: (_) => _.timestamp({ isNullable: true }),
      })
      .primaryKey('id')
      .defaultAlias('testTable')
      .build();
  }

  describe('SQL generation with DEFAULT keyword', () => {
    it('should generate SQL with DEFAULT keyword for undefined values in columns with defaults', () => {
      const insertQuery = db.insert(TestTable).values({
        id: '1',
        name: 'test',
        created_at: undefined, // Should use DEFAULT
        retry_count: undefined, // Should use DEFAULT
        status: undefined, // Should use DEFAULT
        updated_at: undefined, // Should be NULL (no default)
      });

      const sqlString = insertQuery.getSqlString();

      expect(sqlString.getQuery()).toBe(
        '\n    INSERT INTO "public"."test_default_values" AS "testTable"\n    ("id","name","created_at","retry_count","status") VALUES \n    ($1,$2,DEFAULT,DEFAULT,DEFAULT)\n    \n    \n  '
      );
      expect(sqlString.getParameters()).toEqual(['1', 'test']);
    });

    it('should generate SQL without DEFAULT for explicit values', () => {
      const customDate = new Date('2024-01-01T10:00:00Z');

      const insertQuery = db.insert(TestTable).values({
        id: '2',
        name: 'test user 2',
        created_at: customDate, // Explicit value
        retry_count: 5, // Explicit value
        status: 'active', // Explicit value
        updated_at: undefined,
      });

      const sqlString = insertQuery.getSqlString();

      expect(sqlString.getQuery()).toBe(
        '\n    INSERT INTO "public"."test_default_values" AS "testTable"\n    ("id","name","created_at","retry_count","status") VALUES \n    ($1,$2,$3,$4,$5)\n    \n    \n  '
      );
      expect(sqlString.getParameters()).toEqual([
        '2',
        'test user 2',
        customDate,
        5,
        'active',
      ]);
    });

    it('should handle mixed undefined and explicit values in batch inserts', () => {
      const customDate = new Date('2024-01-01T10:00:00Z');

      const insertQuery = db.insert(TestTable).values([
        {
          id: '3',
          name: 'user 3',
          created_at: undefined, // Use DEFAULT
          retry_count: undefined, // Use DEFAULT
          status: 'active', // Explicit value
          updated_at: undefined,
        },
        {
          id: '4',
          name: 'user 4',
          created_at: customDate, // Explicit value
          retry_count: 10, // Explicit value
          status: undefined, // Use DEFAULT
          updated_at: undefined,
        },
      ]);

      const sqlString = insertQuery.getSqlString();

      expect(sqlString.getQuery()).toBe(
        '\n    INSERT INTO "public"."test_default_values" AS "testTable"\n    ("id","name","created_at","retry_count","status") VALUES \n    ($1,$2,DEFAULT,DEFAULT,$3),\n($4,$5,$6,$7,DEFAULT)\n    \n    \n  '
      );
      expect(sqlString.getParameters()).toEqual([
        '3',
        'user 3',
        'active',
        '4',
        'user 4',
        customDate,
        10,
      ]);
    });
  });

  describe('Type safety', () => {
    it('should allow undefined for columns with defaults', () => {
      // This should compile without TypeScript errors
      const insertQuery = db.insert(TestTable).values({
        id: '8',
        name: 'user 8',
        created_at: undefined, // Should be allowed
        retry_count: undefined, // Should be allowed
        status: undefined, // Should be allowed
        updated_at: undefined, // Should be allowed (nullable)
      });

      expect(insertQuery).toBeDefined();

      // Verify the types allow this
      const sqlString = insertQuery.getSqlString();
      expect(sqlString).toBeDefined();
    });
  });
});
