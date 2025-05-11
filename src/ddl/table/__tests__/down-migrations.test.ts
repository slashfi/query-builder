import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../../../db-helper';
import type { SchemaDiff } from '../../../introspection/schema-diff';
import { sql } from '../../../sql-string';
import { injectParameters } from '../../../sql-string/helpers';
import { generateMigrations } from '../../generate-migrations';

describe('Down Migrations', () => {
  const db = createDb({
    query: async () => {
      return [];
    },
    runQueriesInTransaction: async () => {},
    discriminator: createDbDiscriminator('test'),
    getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
  });
  describe('Column Modifications', () => {
    it('should correctly reverse ADD COLUMN to DROP COLUMN', () => {
      interface UserSchema {
        id: string;
        email: string;
      }

      class UserTable {
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

      const diff: SchemaDiff = {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [
              {
                name: 'email',
                type: { schema: 'varchar' },
                nullable: { schema: false },
              },
            ],
            extraColumns: [],
            modifiedColumns: [],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up adds the column
      expect(injectParameters(up[0])).toContain(
        'ALTER TABLE "public"."users" ADD COLUMN "email"'
      );

      // Verify down drops the column
      expect(injectParameters(down[0])).toContain(
        'ALTER TABLE "public"."users" DROP COLUMN "email"'
      );
    });

    it('should correctly reverse DROP COLUMN to ADD COLUMN', () => {
      interface UserSchema {
        id: string;
      }

      class UserTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const diff: SchemaDiff = {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [
              {
                name: 'email',
                type: { db: 'varchar' },
                nullable: { db: false },
              },
            ],
            modifiedColumns: [],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up drops the column
      expect(injectParameters(up[0])).toContain('DROP COLUMN "email"');

      // Verify down adds the column back with original type
      expect(injectParameters(down[0])).toContain(
        'ADD COLUMN "email" VARCHAR NOT NULL'
      );
    });

    it('should correctly reverse ALTER COLUMN type changes', () => {
      interface UserSchema {
        id: string;
        count: number;
      }

      class UserTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            count: (_) => _.int(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const diff: SchemaDiff = {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [],
            modifiedColumns: [
              {
                name: 'count',
                type: { schema: 'integer', db: 'bigint' },
                nullable: { schema: false, db: false },
              },
            ],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up alters column type to integer
      expect(injectParameters(up[0])).toContain(
        'ALTER COLUMN "count" SET DATA TYPE integer'
      );

      // Verify down reverts column type to bigint
      expect(injectParameters(down[0])).toContain(
        'ALTER COLUMN "count" SET DATA TYPE bigint'
      );
    });

    it('should correctly reverse ALTER COLUMN nullability changes', () => {
      interface UserSchema {
        id: string;
        email: string | undefined;
      }

      class UserTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar({ isNullable: true }),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const diff: SchemaDiff = {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [],
            modifiedColumns: [
              {
                name: 'email',
                type: { schema: 'varchar', db: 'varchar' },
                nullable: { schema: true, db: false },
              },
            ],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up drops NOT NULL constraint
      expect(injectParameters(up[0])).toContain(
        'ALTER COLUMN "email" DROP NOT NULL'
      );

      // Verify down adds NOT NULL constraint back
      expect(injectParameters(down[0])).toContain(
        'ALTER COLUMN "email" SET NOT NULL'
      );
    });
  });

  describe('Primary Key Modifications', () => {
    it('should correctly reverse primary key changes', () => {
      interface UserSchema {
        id: string;
        email: string;
      }

      class UserTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
          })
          .primaryKey('email') // Changed from 'id' to 'email'
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const diff: SchemaDiff = {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [],
            modifiedColumns: [],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
            primaryKeyDiff: {
              schema: ['email'],
              db: ['id'],
            },
          },
        ],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up drops old PK and adds new one
      expect(injectParameters(up[0])).toContain(
        'ALTER TABLE "public"."users" ALTER PRIMARY KEY USING COLUMNS ("email")'
      );

      // Verify down reverts PK change
      expect(injectParameters(down[0])).toContain(
        'ALTER TABLE "public"."users" ALTER PRIMARY KEY USING COLUMNS ("id")'
      );
    });
  });

  describe('Table Operations', () => {
    it('should correctly reverse CREATE TABLE to DROP TABLE', () => {
      interface UserSchema {
        id: string;
        email: string;
      }

      class UserTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .schema('public')
          .defaultAlias('users')
          .introspect()
          .build();
      }

      const diff: SchemaDiff = {
        missingTables: ['users'],
        extraTables: [],
        modifiedTables: [],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up creates the table
      expect(injectParameters(up[0])).toContain('CREATE TABLE');
      expect(injectParameters(up[0])).toContain('"public"."users"');

      // Verify down drops the table
      expect(injectParameters(down[0])).toContain('DROP TABLE');
      expect(injectParameters(down[0])).toContain('"public"."users"');
    });

    it('should correctly handle table with indexes', () => {
      interface UserSchema {
        id: string;
        email: string;
        createdAt: Date;
      }

      class UserTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
            createdAt: (_) => _.timestamp(),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect()
          .indexes(({ table, index }) => ({
            email_idx: index(table.email).unique(),
            created_idx: index(table.createdAt),
          }))
          .build();
      }

      const diff: SchemaDiff = {
        missingTables: ['users'],
        extraTables: [],
        modifiedTables: [],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up creates table and indexes
      expect(up).toHaveLength(3); // CREATE TABLE + 2 CREATE INDEX
      expect(injectParameters(up[0])).toContain('CREATE TABLE');
      expect(injectParameters(up[1])).toContain(
        'CREATE UNIQUE INDEX "users_email_idx"'
      );
      expect(injectParameters(up[2])).toContain(
        'CREATE INDEX "users_created_idx"'
      );

      // Verify down drops indexes and table in correct order
      expect(down).toHaveLength(1);

      expect(injectParameters(down[0])).toContain(
        'DROP TABLE "public"."users" CASCADE'
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple changes in correct order', () => {
      interface UserSchema {
        id: string;
        email: string;
        name: string | undefined;
      }

      class UserTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            email: (_) => _.varchar(),
            name: (_) => _.varchar({ isNullable: true }),
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

      const diff: SchemaDiff = {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [
              {
                name: 'name',
                type: { schema: 'varchar' },
                nullable: { schema: true },
              },
            ],
            extraColumns: [],
            modifiedColumns: [
              {
                name: 'email',
                type: { schema: 'varchar', db: 'text' },
                nullable: { schema: false, db: false },
              },
            ],
            missingIndexes: [
              {
                name: 'users_email_idx',
                table: 'users',
                schema: 'public',
                expressions: [sql`email`],
                unique: true,
                method: 'btree',
                ascending: [true],
                storingColumns: [],
                nullsNotDistinct: false,
                withClause: undefined,
                storageParameters: undefined,
                whereClause: undefined,
                ifNotExists: false,
                concurrently: false,
                previousState: undefined,
              },
            ],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      };

      const { up, down } = generateMigrations(diff, [UserTable]);

      // Verify up statements
      expect(up).toHaveLength(3);
      expect(injectParameters(up[0])).toContain('ADD COLUMN "name"');
      expect(injectParameters(up[1])).toContain(
        'ALTER TABLE "public"."users" ALTER COLUMN "email" SET DATA TYPE varchar'
      );
      expect(injectParameters(up[2])).toContain(
        'CREATE UNIQUE INDEX "users_email_idx"'
      );

      // Verify down statements in reverse order
      expect(down).toHaveLength(3);
      expect(injectParameters(down[0])).toContain(
        'DROP INDEX "public"."users"@"users_email_idx"'
      );
      expect(injectParameters(down[1])).toContain(
        'ALTER COLUMN "email" SET DATA TYPE text'
      );
      expect(injectParameters(down[2])).toContain('DROP COLUMN "name"');
    });
  });
});
