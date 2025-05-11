import { generateMigrations } from '@slashfi/query-builder/ddl/generate-migrations';
import { introspectSchema } from '@slashfi/query-builder/introspection/introspect-schema';
import { diffSchemas } from '@slashfi/query-builder/introspection/schema-diff';
import type { SqlString } from '@slashfi/query-builder/sql-string';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  TestItemsTable,
  db,
  queryExecutor,
} from './index-query-builder.schema';
/**
 * These tests require a running CockroachDB instance.
 * Run `yarn test:db:setup` before running the tests.
 * Run `yarn test:db:teardown` when done.
 */
describe('Index Query Builder Integration', () => {
  let pgDb: pg.Client;

  beforeAll(async () => {
    process.env.TZ = 'Etc/UTC';

    // Wait for database to be ready
    let retries = 5;
    while (retries > 0) {
      try {
        // Try to connect
        pgDb = new pg.Client({
          host: 'localhost',
          port: 26207,
          database: 'querybuilder',
          user: 'root',
          password: '',
          ssl: false,
        });
        await pgDb.connect();
        await pgDb.query('SELECT 1');
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        // Wait 1 second before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Override db query executor with actual postgres connection
    Object.assign(queryExecutor, {
      query: async (_queryName: string, sqlString: SqlString) => {
        return pgDb.query(sqlString.getQuery(), sqlString.getParameters());
      },
    });
  }, 20_000);

  afterAll(async () => {
    await pgDb?.end();
  });

  async function executeMigrations(migrations: {
    up: SqlString[];
    down: SqlString[];
  }) {
    for (const migration of migrations.up) {
      await pgDb.query(migration.getQuery(), migration.getParameters());
    }
  }
  beforeEach(async () => {
    // Clean up any existing test tables
    await pgDb.query('DROP TABLE IF EXISTS test_items');
    Object.assign(queryExecutor, {
      query: async (_queryName: string, sqlString: SqlString) => {
        const res = await pgDb.query(
          sqlString.getQuery(),
          sqlString.getParameters()
        );

        return res.rows;
      },
    });

    // Get current database schema
    const dbSchema = await introspectSchema(
      'public',
      async (query: SqlString) => {
        return (await pgDb.query(query.getQuery(), query.getParameters())).rows;
      },
      [TestItemsTable]
    );

    // Generate and execute migrations
    const diff = diffSchemas([TestItemsTable], dbSchema);
    const migrations = generateMigrations(diff, [TestItemsTable]);
    await executeMigrations(migrations);

    // Insert test data
    await db
      .insert(TestItemsTable)
      .values([
        {
          id: '1',
          name: 'item1',
          status: 'active',
          count: 10,
          metadata: { createdAt: '2023-01-01', updatedAt: '2023-01-02' },
          created_at: new Date('2023-01-01'),
        },
        {
          id: '2',
          name: 'item2',
          status: 'inactive',
          count: 20,
          metadata: { createdAt: '2023-01-02', updatedAt: '2023-01-03' },
          created_at: new Date('2023-01-02'),
        },
        {
          id: '3',
          name: 'item3',
          status: 'active',
          count: 30,
          metadata: { createdAt: '2023-01-03', updatedAt: '2023-01-04' },
          created_at: new Date('2023-01-03'),
        },
      ])
      .returning('*')
      .query();
  });

  afterEach(() => {
    queryExecutor.resetQueryExecutor();
  });

  describe('Basic Queries', () => {
    it('executes simple SELECT query', async () => {
      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_name)
        .where({ name: 'item1' });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        name: 'item1',
      });
    });

    it('executes SELECT with custom columns', async () => {
      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_name)
        .select({
          item_name: (_) => _.testItems.name,
          item_status: (_) => _.testItems.status,
        })
        .where({ name: 'item1' });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        item_name: 'item1',
        item_status: 'active',
      });
    });

    it('executes SELECT with nested format', async () => {
      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_name)
        .select({
          basic: {
            name: (_) => _.testItems.name,
            status: (_) => _.testItems.status,
          },
          meta: {
            created: (_) =>
              _.testItems.metadata.accessStringPath((_) => _.createdAt),
            updated: (_) =>
              _.testItems.metadata.accessStringPath((_) => _.updatedAt),
          },
        })
        .where({ name: 'item1' });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        basic: {
          name: 'item1',
          status: 'active',
        },
        meta: {
          created: '2023-01-01',
          updated: '2023-01-02',
        },
      });
    });

    it('executes SELECT without args and returns all columns', async () => {
      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_name)
        .select()
        .where({ name: 'item1' });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        name: 'item1',
        status: 'active',
        count: 10,
        metadata: {
          createdAt: '2023-01-01',
          updatedAt: '2023-01-02',
        },
        created_at: new Date('2023-01-01'),
      });
    });
  });

  describe('Advanced Queries', () => {
    it('executes SELECT with comparison operators', async () => {
      // Insert some test items with conflicting counts
      await db
        .insert(TestItemsTable)
        .values([
          {
            id: '5',
            name: 'item5',
            status: 'active',
            count: 20,
            metadata: {
              createdAt: '2023-01-05',
              updatedAt: '2023-01-05',
            },
            created_at: new Date('2023-01-05'),
          },
          {
            id: '6',
            name: 'item6',
            status: 'active',
            count: 21,
            metadata: {
              createdAt: '2023-01-06',
              updatedAt: '2023-01-06',
            },
            created_at: new Date('2023-01-06'),
          },
        ])
        .returning('*')
        .query();

      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_count_name)
        .where({
          count: db.gt(15),
          name: db.in(['item5', 'item6']),
        })
        .orderBy({
          count: 'asc',
        });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name)).toEqual(['item5', 'item6']);

      const result2 = await db
        .selectFromIndex(TestItemsTable.idx.by_count_name)
        .where({
          count: db.gt(15),
          name: db.in(['item5', 'item6']),
        })
        .orderBy({
          count: 'desc',
        });

      expect(result2).toHaveLength(2);
      expect(result2.map((r) => r.name)).toEqual(['item6', 'item5']);
    });

    it('executes SELECT with null operator', async () => {
      // First set some fields to null
      await db
        .insert(TestItemsTable)
        .values([
          {
            id: '4',
            name: 'item4',
            status: undefined,
            count: undefined,
            metadata: undefined,
            created_at: new Date('2023-01-04'),
          },
        ])
        .returning('*')
        .query();

      // Test with string column
      const statusResult = await db
        .selectFromIndex(TestItemsTable.idx.by_status_strict)
        .where({ status: db.null() });

      expect(statusResult).toHaveLength(1);
      expect(statusResult[0].status).toBeUndefined();

      // Test with number column
      const countResult = await db
        .selectFromIndex(TestItemsTable.idx.by_count_name)
        .where({ count: db.null(), name: 'item4' });

      expect(countResult).toHaveLength(1);
      expect(countResult[0].count).toBeUndefined();

      // Test with not operator
      const notNullResult = await db
        .selectFromIndex(TestItemsTable.idx.by_status_strict)
        .where({ status: db.not(db.null()) });

      expect(notNullResult).toHaveLength(3); // All non-null status records
      expect(notNullResult.every((r) => r.status !== undefined)).toBe(true);
    });

    it('executes SELECT with multiple conditions', async () => {
      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_name)
        .where({ name: 'item1' })
        .andWhere((_) =>
          _.testItems.status.equals('active').and(_.testItems.count.moreThan(5))
        );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        name: 'item1',
      });
    });

    it('executes SELECT with LIMIT', async () => {
      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_status_strict)
        .where({ status: 'active' })
        .limit(2);

      expect(result).toHaveLength(2);
    });

    it('throws on empty result when using throwsIfEmpty', async () => {
      await expect(
        db
          .selectFromIndex(TestItemsTable.idx.by_name)
          .where({ name: 'nonexistent' })
          .throwsIfEmpty()
      ).rejects.toThrow('No results found');
    });

    it('throws on multiple results when using expectOne', async () => {
      await expect(
        db
          .selectFromIndex(TestItemsTable.idx.by_status_strict)
          .where({ status: 'active' })
          .expectOne()
      ).rejects.toThrow('Multiple results found when expecting unique result');
    });

    describe('Order By', () => {
      it('orders by single column ascending', async () => {
        const result = await db
          .selectFromIndex(TestItemsTable.idx.by_count_name)
          .where({ count: db.gt(0), name: db.in(['item1', 'item2', 'item3']) })
          .orderBy({ count: 'asc' });

        expect(result).toHaveLength(3);
        expect(result.map((r) => r.count)).toEqual([10, 20, 30]);
      });

      it('orders by single column descending', async () => {
        const result = await db
          .selectFromIndex(TestItemsTable.idx.by_count_name)
          .where({ count: db.gt(0), name: db.in(['item1', 'item2', 'item3']) })
          .orderBy({ count: 'desc' });

        expect(result).toHaveLength(3);
        expect(result.map((r) => r.count)).toEqual([30, 20, 10]);
      });

      it('orders by multiple columns', async () => {
        // Insert additional test data with same status but different counts
        await db
          .insert(TestItemsTable)
          .values([
            {
              id: '4',
              name: 'item4',
              status: 'active',
              count: 40,
              metadata: { createdAt: '2023-01-04', updatedAt: '2023-01-05' },
              created_at: new Date('2023-01-04'),
            },
          ])
          .returning('*')
          .query();

        const result = await db
          .selectFromIndex(TestItemsTable.idx.by_status_strict)
          .where({ status: db.in(['active', 'inactive']) })
          .orderBy({
            status: 'asc',
          });

        expect(result).toHaveLength(4);
        expect(result.map((r) => ({ status: r.status, id: r.id }))).toEqual([
          { status: 'active', id: '1' },
          { status: 'active', id: '3' },
          { status: 'active', id: '4' },
          { status: 'inactive', id: '2' },
        ]);
      });

      it('orders by expression', async () => {
        const result = await db
          .selectFromIndex(TestItemsTable.idx.by_count_name)
          .where({ count: db.gt(0), name: db.in(['item1', 'item2', 'item3']) })
          .orderBy({
            count: 'desc',
            name: 'asc',
          });

        expect(result).toHaveLength(3);
        expect(result.map((r) => r.count)).toEqual([30, 20, 10]);
      });
    });
  });

  describe('Strict Indexes', () => {
    it('executes SELECT with unique index', async () => {
      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_name)
        .where({ name: 'item1' })
        .expectOne();

      expect(result).toEqual([
        {
          id: '1',
          name: 'item1',
        },
      ]);
    });

    it('executes SELECT with partial index using where condition', async () => {
      // Insert test items with different combinations of count and name
      await db
        .insert(TestItemsTable)
        .values([
          {
            id: 'partial1',
            name: 'partial1',
            count: 10,
            status: 'active',
            created_at: new Date(),
            metadata: { createdAt: '2023-01-01', updatedAt: '2023-01-02' },
          },
          {
            id: 'partial2',
            name: 'partial2',
            count: undefined,
            status: 'active',
            created_at: new Date(),
            metadata: { createdAt: '2023-01-01', updatedAt: '2023-01-02' },
          },
        ])
        .query();

      const resultWithBoth = await db
        .selectFromIndex(TestItemsTable.idx.by_non_null_count_with_name)
        .where({ name: db.in(['partial1', 'partial2']) });

      // partial2 shouldn't be returned because it doesn't have a count

      expect(resultWithBoth).toHaveLength(1);
      expect(resultWithBoth[0].id).toBe('partial1');
    });

    it('executes SELECT with composite index and storing', async () => {
      await db
        .insert(TestItemsTable)
        .values([
          {
            id: '5',
            name: 'item5',
            status: 'active',
            count: 10,
            metadata: { createdAt: '2023-01-01', updatedAt: '2023-01-02' },
            created_at: new Date('2023-01-01'),
          },
        ])
        .returning('*')
        .query();

      const result = await db
        .selectFromIndex(TestItemsTable.idx.by_count_name)
        .where({
          count: 10,
          name: 'item5',
        });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '5',
        name: 'item5',
        count: 10,
        status: 'active',
      });
    });
  });
});
