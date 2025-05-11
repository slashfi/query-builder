import nodePg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../../../db-helper';
import { introspectSchema } from '../../../introspection/introspect-schema';
import { diffSchemas } from '../../../introspection/schema-diff';
import type { SqlString } from '../../../sql-string';
import { generateMigrations } from '../../generate-migrations';

/**
 * These tests require a running CockroachDB instance.
 * Run `yarn test:db:setup` before running the tests.
 * Run `yarn test:db:teardown` when done.
 */
describe('Introspection Rules', () => {
  let pg: nodePg.Client;
  const testSym = createDbDiscriminator('test');
  const db = createDb({
    query: async () => [],
    runQueriesInTransaction: async () => {},
    discriminator: testSym,
    getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
  });

  beforeAll(async () => {
    // Wait for database to be ready
    let retries = 5;
    while (retries > 0) {
      try {
        // Try to connect
        pg = new nodePg.Client({
          host: 'localhost',
          port: 26207,
          database: 'querybuilder',
          user: 'root',
          password: '',
          ssl: false,
        });
        await pg.connect();
        await pg.query('SELECT 1');
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
    await pg?.end();
  });

  beforeEach(async () => {
    // Clean up any existing test tables before each test
    await pg.query('DROP TABLE IF EXISTS users');
  });

  async function executeMigrations(migrations: {
    up: SqlString[];
    down: SqlString[];
  }) {
    for (const migration of migrations.up) {
      await pg.query(migration.getQuery(), migration.getParameters());
    }
  }

  describe('Table Introspection', () => {
    it('should skip tables with introspection disabled', async () => {
      interface UserSchema {
        id: string;
        email: string;
      }

      class UsersTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .build();
      }

      const dbSchema = await introspectSchema(
        'public',
        async (query) => {
          return (await pg.query(query.getQuery(), query.getParameters())).rows;
        },
        [UsersTable]
      );

      const diff = diffSchemas([UsersTable], dbSchema);

      // Should not include disabled table in diff
      expect(diff.missingTables).toHaveLength(0);
      expect(diff.modifiedTables).toHaveLength(0);

      // No migrations should be generated
      const statements = generateMigrations(diff, [UsersTable]);

      expect(statements.up).toHaveLength(0);
      expect(statements.down).toHaveLength(0);
    });

    it('should include tables with introspection enabled', async () => {
      interface UserSchema {
        id: string;
        email: string;
      }

      class UsersTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const dbSchema = await introspectSchema(
        'public',
        async (query) => {
          return (await pg.query(query.getQuery(), query.getParameters())).rows;
        },
        [UsersTable]
      );

      const diff = diffSchemas([UsersTable], dbSchema);

      // Should include table in diff with modified column
      expect(diff.missingTables).toHaveLength(1);
      expect(diff.modifiedTables).toHaveLength(0);

      // Should generate migration to fix column type
      const statements = generateMigrations(diff, [UsersTable]);
      expect(statements.up).toHaveLength(1);
      expect(statements.up[0].getQuery()).toContain(
        'CREATE TABLE "public"."users"'
      );

      await executeMigrations(statements);

      const res = (await pg.query(`SHOW CREATE TABLE "public"."users"`)).rows;
      expect(res).toHaveLength(1);
      expect(res[0].create_statement).toContain('CREATE TABLE public.users');
    });

    it('should respect column introspection rules', async () => {
      // First create table without internal field
      interface InitialUserSchema {
        id: string;
        email: string;
      }

      class InitialUsersTable {
        static readonly Table = db
          .buildTableFromSchema<InitialUserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const initialDiff = diffSchemas([InitialUsersTable], { tables: [] });
      const initialMigrations = generateMigrations(initialDiff, [
        InitialUsersTable,
      ]);
      await executeMigrations(initialMigrations);

      // Then try to introspect with internal field
      interface UserSchema {
        id: string;
        email: string;
        internalField: string;
      }

      class UsersTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
            internalField: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .schema('public')
          .defaultAlias('users')
          .introspect({
            columns: 'enforce',
            constraints: 'enforce',
            ignoreColumns: [/^internal/], // Ignore columns starting with 'internal'
          })
          .build();
      }

      const dbSchema = await introspectSchema(
        'public',
        async (query) => {
          return (await pg.query(query.getQuery(), query.getParameters())).rows;
        },
        [UsersTable]
      );

      const diff = diffSchemas([UsersTable], dbSchema);

      // Should not include ignored column in diff
      expect(diff.missingTables).toHaveLength(0);
      expect(diff.modifiedTables).toHaveLength(0);

      // No migrations should be generated
      const statements = generateMigrations(diff, [UsersTable]);

      expect(statements.up).toHaveLength(0);
      expect(statements.down).toHaveLength(0);
    });

    it('should respect index introspection rules', async () => {
      // First create table without indexes
      interface InitialUserSchema {
        id: string;
        email: string;
        searchField: string;
      }

      class InitialUsersTable {
        static readonly Table = db
          .buildTableFromSchema<InitialUserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
            searchField: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const initialDiff = diffSchemas([InitialUsersTable], { tables: [] });
      const initialMigrations = generateMigrations(initialDiff, [
        InitialUsersTable,
      ]);
      await executeMigrations(initialMigrations);

      // Then try to introspect with indexes
      interface UserSchema {
        id: string;
        email: string;
        searchField: string;
      }

      class UsersTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
            searchField: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .indexes(({ table, index }) => ({
            email_idx: index(table.email).unique(),
            search_idx: index(table.searchField).using('gin'),
          }))
          .introspect({
            indexes: 'enforce',
            ignoreIndexes: [/_search_/], // Ignore search indexes
          })
          .build();
      }

      const dbSchema = await introspectSchema(
        'public',
        async (query) => {
          return (await pg.query(query.getQuery(), query.getParameters())).rows;
        },
        [UsersTable]
      );

      const diff = diffSchemas([UsersTable], dbSchema);

      // Should only include non-ignored missing index
      expect(diff.missingTables).toHaveLength(0);
      expect(diff.modifiedTables).toHaveLength(1);
      expect(diff.modifiedTables[0].missingIndexes).toHaveLength(1);
      expect(diff.modifiedTables[0].missingIndexes[0].name).toBe(
        'users_email_idx'
      );

      // Should only generate migration for non-ignored index
      const statements = generateMigrations(diff, [UsersTable]);

      expect(statements.up).toHaveLength(1);
      expect(statements.up[0].getQuery()).toContain('CREATE UNIQUE INDEX');
      expect(statements.up[0].getQuery()).toContain('"users_email_idx"');
      expect(statements.up[0].getQuery()).not.toContain('"users_search_idx"');
    });

    describe('Index Sync Modes', () => {
      it('should only add new indexes in additive mode', async () => {
        // First create table with initial indexes
        interface InitialUserSchema {
          id: string;
          email: string;
          name: string;
        }

        class InitialUsersTable {
          static readonly Table = db
            .buildTableFromSchema<InitialUserSchema>()
            .columns({
              id: (_) => _.varchar(),
              email: (_) => _.varchar(),
              name: (_) => _.varchar(),
            })
            .primaryKey('id')
            .tableName('users')
            .defaultAlias('users')
            .indexes(({ table, index }) => ({
              email_idx: index(table.email).unique(),
            }))
            .introspect()
            .build();
        }

        const initialDiff = diffSchemas([InitialUsersTable], { tables: [] });
        const initialMigrations = generateMigrations(initialDiff, [
          InitialUsersTable,
        ]);
        await executeMigrations(initialMigrations);

        // Then update schema with different indexes
        interface UserSchema {
          id: string;
          email: string;
          name: string;
        }

        class UsersTable {
          static readonly Table = db
            .buildTableFromSchema<UserSchema>()
            .columns({
              id: (_) => _.varchar(),
              email: (_) => _.varchar(),
              name: (_) => _.varchar(),
            })
            .primaryKey('id')
            .tableName('users')
            .defaultAlias('users')
            .indexes(({ table, index }) => ({
              name_idx: index(table.name), // New index
              // users_email_idx removed from schema
            }))
            .introspect({
              indexes: 'enforce',
              indexSyncMode: 'additive', // Only add new indexes
            })
            .build();
        }

        const dbSchema = await introspectSchema(
          'public',
          async (query) => {
            return (await pg.query(query.getQuery(), query.getParameters()))
              .rows;
          },
          [UsersTable]
        );

        const diff = diffSchemas([UsersTable], dbSchema);

        // Should only include missing index, not extra index
        expect(diff.modifiedTables).toHaveLength(1);
        expect(diff.modifiedTables[0].missingIndexes).toHaveLength(1);
        expect(diff.modifiedTables[0].missingIndexes[0].name).toBe(
          'users_name_idx'
        );
        expect(diff.modifiedTables[0].extraIndexes).toHaveLength(0);

        const statements = generateMigrations(diff, [UsersTable]);
        expect(statements.up).toHaveLength(1);
        expect(statements.up[0].getQuery()).toContain(
          'CREATE INDEX "users_name_idx"'
        );
        expect(statements.up[0].getQuery()).not.toContain(
          'DROP INDEX "public"."users"@"users_email_idx"'
        );

        await executeMigrations(statements);

        // Verify both indexes exist in database
        const res = (await pg.query(`SHOW CREATE TABLE "public"."users"`)).rows;
        expect(res[0].create_statement).toContain('users_email_idx');
        expect(res[0].create_statement).toContain('users_name_idx');
      });

      it('should add new and remove extra indexes in full sync mode', async () => {
        // First create table with initial indexes
        interface InitialUserSchema {
          id: string;
          email: string;
          name: string;
        }

        class InitialUsersTable {
          static readonly Table = db
            .buildTableFromSchema<InitialUserSchema>()
            .columns({
              id: (_) => _.varchar(),
              email: (_) => _.varchar(),
              name: (_) => _.varchar(),
            })
            .primaryKey('id')
            .tableName('users')
            .defaultAlias('users')
            .indexes(({ table, index }) => ({
              email_idx: index(table.email).unique(),
            }))
            .introspect()
            .build();
        }

        const initialDiff = diffSchemas([InitialUsersTable], { tables: [] });
        const initialMigrations = generateMigrations(initialDiff, [
          InitialUsersTable,
        ]);
        await executeMigrations(initialMigrations);

        // Then update schema with different indexes
        interface UserSchema {
          id: string;
          email: string;
          name: string;
        }

        class UsersTable {
          static readonly Table = db
            .buildTableFromSchema<UserSchema>()
            .columns({
              id: (_) => _.varchar(),
              email: (_) => _.varchar(),
              name: (_) => _.varchar(),
            })
            .primaryKey('id')
            .tableName('users')
            .defaultAlias('users')
            .indexes(({ table, index }) => ({
              name_idx: index(table.name), // New index
              // users_email_idx removed from schema
            }))
            .introspect({
              indexes: 'enforce',
              indexSyncMode: 'full', // Add new and remove extra indexes
            })
            .build();
        }

        const dbSchema = await introspectSchema(
          'public',
          async (query) => {
            return (await pg.query(query.getQuery(), query.getParameters()))
              .rows;
          },
          [UsersTable]
        );

        const diff = diffSchemas([UsersTable], dbSchema);

        // Should include both missing and extra indexes
        expect(diff.modifiedTables).toHaveLength(1);
        expect(diff.modifiedTables[0].missingIndexes).toHaveLength(1);
        expect(diff.modifiedTables[0].missingIndexes[0].name).toBe(
          'users_name_idx'
        );
        expect(diff.modifiedTables[0].extraIndexes).toHaveLength(1);
        expect(diff.modifiedTables[0].extraIndexes[0].name).toBe(
          'users_email_idx'
        );

        const statements = generateMigrations(diff, [UsersTable]);
        expect(statements.up).toHaveLength(2); // Create new index + drop old index
        expect(statements.up[0].getQuery()).toContain(
          'CREATE INDEX "users_name_idx"'
        );
        expect(statements.up[1].getQuery()).toContain(
          'DROP INDEX "public"."users"@"users_email_idx"'
        );

        await executeMigrations(statements);

        // Verify only new index exists in database
        const res = (await pg.query(`SHOW CREATE TABLE "public"."users"`)).rows;
        expect(res[0].create_statement).not.toContain('users_email_idx');
        expect(res[0].create_statement).toContain('users_name_idx');
      });
    });
  });
});
