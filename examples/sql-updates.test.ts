import { generateMigrations } from '@slashfi/query-builder/ddl/generate-migrations';
import { introspectSchema } from '@slashfi/query-builder/introspection/introspect-schema';
import { diffSchemas } from '@slashfi/query-builder/introspection/schema-diff';
import type { SqlString } from '@slashfi/query-builder/sql-string';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UpdateTestTable, db, queryExecutor } from './sql-updates.schema';

describe('SQL Update Operations', () => {
  describe('Runtime Behavior', () => {
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
      await pgDb.query('DROP TABLE IF EXISTS update_test');
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
          return (await pgDb.query(query.getQuery(), query.getParameters()))
            .rows;
        },
        [UpdateTestTable]
      );

      // Generate and execute migrations
      const diff = diffSchemas([UpdateTestTable], dbSchema);
      const migrations = generateMigrations(diff, [UpdateTestTable]);
      await executeMigrations(migrations);

      // Insert test data
      await db
        .insert(UpdateTestTable)
        .values([
          {
            id: '1',
            name: 'item1',
            status: 'active',
            count: 10,
            metadata: { createdAt: '2023-01-01', updatedAt: '2023-01-02' },
            created_at: new Date('2023-01-01'),
            tags: undefined,
          },
          {
            id: '2',
            name: 'item2',
            status: 'inactive',
            count: 20,
            metadata: { createdAt: '2023-01-02', updatedAt: '2023-01-03' },
            created_at: new Date('2023-01-02'),
            tags: undefined,
          },
        ])
        .returning('*')
        .query();
    });

    it('updates rows with proper FROM clause join', async () => {
      const result = await db
        .update(UpdateTestTable)
        .setFields((_) => [
          _.updateTest.id,
          _.updateTest.status,
          _.updateTest.count,
        ])
        .values({
          id: '1',
          status: 'inactive',
          count: 50,
        })
        .where((_) => _.values.id.equals(_.updateTest.id))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('inactive');
      expect(result[0].count).toBe(50);
    });

    it('updates rows with additional conditions', async () => {
      const result = await db
        .update(UpdateTestTable)
        .setFields((_) => [
          _.updateTest.id,
          _.updateTest.status,
          _.updateTest.count,
        ])
        .values({
          id: '1',
          status: 'inactive' as const,
          count: 50,
        })
        .where((_) =>
          _.values.id
            .equals(_.updateTest.id)
            .and(_.updateTest.status.equals('active'))
        )
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].status).toBe('inactive');
      expect(result[0].count).toBe(50);
    });

    it('updates array fields', async () => {
      const result = await db
        .update(UpdateTestTable)
        .setFields((_) => [_.updateTest.id, _.updateTest.tags])
        .values({
          id: '1',
          tags: ['tag1', 'tag2'],
        })
        .where((_) => _.values.id.equals(_.updateTest.id))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['tag1', 'tag2']);
    });

    it('updates date fields', async () => {
      const newDate = new Date('2024-01-01T00:00:00Z');
      const result = await db
        .update(UpdateTestTable)
        .setFields((_) => [_.updateTest.id, _.updateTest.created_at])
        .values({
          id: '1',
          created_at: newDate,
        })
        .where((_) => _.values.id.equals(_.updateTest.id))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].created_at).toEqual(newDate);
    });

    it('updates jsonb fields', async () => {
      const newMetadata = {
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      };
      const result = await db
        .update(UpdateTestTable)
        .setFields((_) => [_.updateTest.id, _.updateTest.metadata])
        .values({
          id: '1',
          metadata: newMetadata,
        })
        .where((_) => _.values.id.equals(_.updateTest.id))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].metadata).toEqual(newMetadata);
    });

    it('returns void when no returning clause', async () => {
      const result = await db
        .update(UpdateTestTable)
        .setFields((_) => [
          _.updateTest.id,
          _.updateTest.status,
          _.updateTest.count,
        ])
        .values({
          id: '1',
          status: 'inactive',
          count: 50,
        })
        .where((_) => _.values.id.equals(_.updateTest.id));

      expect(result).toBeUndefined();

      // Verify the update
      const updated = await db
        .selectFromIndex(UpdateTestTable.idx.by_name_status_strict)
        .where({ name: 'item1', status: 'inactive' });

      expect(updated).toHaveLength(1);
      expect(updated[0].status).toBe('inactive');
    });
  });
});
