import pg from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TableBase } from '../base';
import { type Db, createDb, createDbDiscriminator } from '../db-helper';

describe('Transaction support', () => {
  let pgDb: pg.Client;
  const dbDiscriminator = createDbDiscriminator('test');
  let db: Db<typeof dbDiscriminator>;
  let TestTable: {
    Table: TableBase<typeof dbDiscriminator>;
  };

  beforeEach(async () => {
    console.log('Setting up test...');
    process.env.TZ = 'Etc/UTC';

    // Wait for database to be ready
    let retries = 5;
    while (retries > 0) {
      console.log('Retrying...');
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

        db = createDb({
          query: async (_queryName, sqlStr, manager: pg.Client | undefined) => {
            const client = manager ?? pgDb;
            const res = await client.query(
              sqlStr.getQuery(),
              sqlStr.getParameters()
            );
            return res.rows;
          },
          runQueriesInTransaction: async (runQueries) => {
            await pgDb.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
            try {
              await runQueries(pgDb);
              await pgDb.query('COMMIT TRANSACTION');
            } catch (e) {
              await pgDb.query('ROLLBACK TRANSACTION');
              throw e;
            }
          },
          discriminator: createDbDiscriminator('test'),
          getQueryBuilderIndexes: () =>
            Promise.resolve({ queryBuilderIndexes: {} }),
        });

        TestTable = {
          Table: db
            .buildTableFromSchema<{ id: string; test: string }>()
            .tableName('test')
            .defaultAlias('test')
            .primaryKey('id')
            .columns({
              id: (_) => _.varchar(),
              test: (_) => _.varchar(),
            })
            .build(),
        };

        await pgDb.query(
          'CREATE TABLE IF NOT EXISTS test (id VARCHAR PRIMARY KEY, test VARCHAR)'
        );

        await pgDb.query('DELETE FROM test');

        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        // Wait 1 second before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  });

  it('should execute queries within a transaction', async () => {
    await expect(
      db.transaction(async () => {
        await db
          .insert(TestTable)
          .values({
            id: '1',
            test: 'test',
          })
          .query();

        throw new Error('Transaction should fail');
      })
    ).rejects.toThrow('Transaction should fail');

    const res = await pgDb.query('SELECT * FROM test');
    expect(res.rows).toEqual([]);
  });

  it('should reuse existing transaction if nested', async () => {
    await db.transaction(async () => {
      // Insert in parent transaction
      await db
        .insert(TestTable)
        .values({
          id: '1',
          test: 'parent',
        })
        .query();

      // Nested transaction
      await db.transaction(async () => {
        await db
          .insert(TestTable)
          .values({
            id: '2',
            test: 'nested',
          })
          .query();
      });

      // Insert after nested transaction
      await db
        .insert(TestTable)
        .values({
          id: '3',
          test: 'after_nested',
        })
        .query();
    });

    const res = await pgDb.query('SELECT * FROM test ORDER BY id');
    expect(res.rows).toEqual([
      { id: '1', test: 'parent' },
      { id: '2', test: 'nested' },
      { id: '3', test: 'after_nested' },
    ]);
  });

  it('should commit transaction on success', async () => {
    await db.transaction(async () => {
      await db
        .insert(TestTable)
        .values({
          id: '1',
          test: 'success',
        })
        .query();
    });

    const res = await pgDb.query('SELECT * FROM test');
    expect(res.rows).toEqual([{ id: '1', test: 'success' }]);
  });
});
