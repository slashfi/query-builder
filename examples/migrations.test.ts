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
import { UsersTable, db, queryExecutor } from './migrations.schema';

describe('Migration Integration', () => {
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
    await pgDb.query('DROP TABLE IF EXISTS migration_users');
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
      [UsersTable]
    );

    // Generate and execute migrations
    const diff = diffSchemas([UsersTable], dbSchema);
    const migrations = generateMigrations(diff, [UsersTable]);

    await executeMigrations(migrations);
  });

  afterEach(() => {
    queryExecutor.resetQueryExecutor();
  });

  describe('Default Values', () => {
    it('should set default value for created_at when inserting', async () => {
      // Insert without created_at
      const { result } = await db
        .insert(UsersTable)
        .values({
          id: '1',
          email: 'test@example.com',
          updated_at: undefined,
          last_login: undefined,
        })
        .returning('*')
        .query();

      expect(result).toHaveLength(1);
      expect(result[0].created_at).toBeDefined();
      expect(result[0].created_at instanceof Date).toBe(true);
    });

    it('should allow overriding default value', async () => {
      const customDate = new Date('2024-01-01');

      // Insert with explicit created_at
      const { result } = await db
        .insert(UsersTable)
        .values({
          id: '1',
          email: 'test@example.com',
          created_at: customDate,
          last_login: undefined,
          updated_at: undefined,
        })
        .returning('*')
        .query();

      expect(result).toHaveLength(1);
      expect(result[0]?.created_at).toEqual(customDate);
    });

    it('should handle nullable columns correctly', async () => {
      // Insert without optional fields
      const { result } = await db
        .insert(UsersTable)
        .values({
          id: '1',
          email: 'test@example.com',
          last_login: undefined,
          updated_at: undefined,
        })
        .returning('*')
        .query();

      expect(result).toHaveLength(1);
      expect(result[0].updated_at).toBeUndefined();
      expect(result[0].last_login).toBeUndefined();
    });

    it('should generate correct migration SQL', async () => {
      // Drop the table to test migration generation
      await pgDb.query('DROP TABLE migration_users');

      // Get current database schema
      const dbSchema = await introspectSchema(
        'public',
        async (query: SqlString) => {
          return (await pgDb.query(query.getQuery(), query.getParameters()))
            .rows;
        },
        [UsersTable]
      );

      // Generate migrations
      const diff = diffSchemas([UsersTable], dbSchema);
      const migrations = generateMigrations(diff, [UsersTable]);

      // Check migration SQL
      const createTableSql = migrations.up[0].getQuery();

      // Check column definitions
      expect(createTableSql).toMatch(
        `"created_at" TIMESTAMP NOT NULL DEFAULT current_timestamp()`
      );
      expect(createTableSql).toMatch(/"updated_at" TIMESTAMP/);
      expect(createTableSql).toMatch(/"last_login" TIMESTAMP/);

      // Verify column order and formatting
      const lines = createTableSql.split('\n');
      const columnLines = lines.filter((line) => line.trim().startsWith('"'));

      expect(
        columnLines.some(
          (line) =>
            line.includes('created_at') &&
            line.includes('TIMESTAMP') &&
            line.includes('DEFAULT current_timestamp()')
        )
      ).toBe(true);
    });
  });
});
