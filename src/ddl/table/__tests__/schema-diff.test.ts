import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../../../db-helper';
import type { FastSchema } from '../../../introspection/introspect-schema';
import { diffSchemas } from '../../../introspection/schema-diff';
import { sql } from '../../../sql-string';

describe('Schema Diffing', () => {
  describe('Default Values', () => {
    it('should detect when default value needs to be added', () => {
      interface UserSchema {
        id: string;
        createdAt: Date;
      }
      const db = createDb({
        query: async () => [],
        runQueriesInTransaction: async () => {},
        discriminator: createDbDiscriminator('test'),
        getQueryBuilderIndexes: () =>
          Promise.resolve({ queryBuilderIndexes: {} }),
        defaultSchema: 'custom_schema',
      });

      class UsersTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            createdAt: (_) => _.timestamp().default(sql`current_timestamp()`),
          })
          .primaryKey('id')
          .tableName('users')
          .defaultAlias('users')
          .introspect({
            columns: 'enforce',
            indexes: 'enforce',
          })
          .build();
      }

      // Mock database schema without default value
      const dbSchema: FastSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 1,
                hidden: false,
              },
              {
                name: 'createdAt',
                type: 'timestamp without time zone',
                udt: '_timestamp',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 2,
                hidden: false,
              },
            ],
            indexes: [],
            createStatement: `
            CREATE TABLE users (
              id VARCHAR NOT NULL,
              "createdAt" TIMESTAMP NOT NULL,
              PRIMARY KEY (id)
            )
          `,
          },
        ],
      };

      const diff = diffSchemas([UsersTable], dbSchema);
      expect(diff.modifiedTables).toHaveLength(1);
      const tableDiff = diff.modifiedTables[0];
      expect(tableDiff.modifiedColumns).toHaveLength(1);
      const modifiedColumn = tableDiff.modifiedColumns[0];
      expect(modifiedColumn.name).toBe('createdAt');
      expect(modifiedColumn.default?.schema?.getQuery()).toBe(
        'current_timestamp()'
      );
      expect(modifiedColumn.default?.db).toBeUndefined();
    });
  });

  describe('Type Normalization', () => {
    it('should handle PostgreSQL type names from statistics vs SHOW CREATE TABLE', () => {
      interface UserSchema {
        id: string;
        email: string;
        createdAt: Date;
      }
      const db = createDb({
        runQueriesInTransaction: async () => {},
        query: async () => [],
        discriminator: createDbDiscriminator('test'),
        getQueryBuilderIndexes: () =>
          Promise.resolve({ queryBuilderIndexes: {} }),
        defaultSchema: 'custom_schema',
      });

      class UsersTable {
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
          .introspect({
            columns: 'enforce',
            indexes: 'enforce',
          })
          .build();
      }

      // Mock database schema with different type names from statistics vs SHOW CREATE TABLE
      const dbSchema: FastSchema = {
        tables: [
          {
            name: 'users',
            // Column info from statistics shows full PostgreSQL type names
            columns: [
              {
                name: 'id',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 1,
                hidden: false,
              },
              {
                name: 'email',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 2,
                hidden: false,
              },
              {
                name: 'createdAt',
                type: 'timestamp without time zone',
                udt: 'timestamp',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 3,
                hidden: false,
              },
            ],
            indexes: [],
            // SHOW CREATE TABLE returns simplified type names
            createStatement: `
            CREATE TABLE public.users (
              id VARCHAR NOT NULL,
              email VARCHAR NOT NULL,
              "createdAt" TIMESTAMP NOT NULL,
              PRIMARY KEY (id)
            )
          `,
          },
        ],
      };

      // Should not detect any type differences despite different type names
      const diff = diffSchemas([UsersTable], dbSchema);
      expect(diff.modifiedTables).toHaveLength(0);
    });
  });

  describe('Index Diffing with CREATE TABLE', () => {
    it('should throw error when unique index changes', () => {
      interface UserSchema {
        id: string;
        email: string;
        createdAt: Date;
      }
      const db = createDb({
        query: async () => [],
        runQueriesInTransaction: async () => {},
        discriminator: createDbDiscriminator('test'),
        getQueryBuilderIndexes: () =>
          Promise.resolve({ queryBuilderIndexes: {} }),
        defaultSchema: 'custom_schema',
      });

      class UsersTable {
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
          .indexes(({ table, index }) => ({
            email_idx: index(table.email).unique(),
            created_idx: index(table.createdAt),
          }))
          .introspect({
            columns: 'enforce',
            indexes: 'enforce',
          })
          .build();
      }

      // Mock database schema with CREATE TABLE statement
      const dbSchema: FastSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 1,
                hidden: false,
              },
              {
                name: 'email',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 2,
                hidden: false,
              },
              {
                name: 'createdAt',
                type: 'timestamp without time zone',
                udt: '_timestamp',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 3,
                hidden: false,
              },
            ],
            indexes: [
              {
                name: 'users_email_idx',
                unique: true,
                parts: [
                  {
                    expression: 'email', // Different from schema ("email")
                    direction: 'ASC',
                    position: 1,
                    storing: false,
                  },
                ],
                includeColumns: [],
              },
              {
                name: 'users_created_idx',
                unique: false,
                parts: [
                  {
                    expression: '"createdAt"',
                    direction: 'ASC',
                    position: 1,
                    storing: false,
                  },
                ],
                includeColumns: [],
              },
            ],
            createStatement: `
            CREATE TABLE public.users (
              id VARCHAR NOT NULL,
              email VARCHAR NOT NULL,
              "createdAt" TIMESTAMP NOT NULL,
              PRIMARY KEY (id),
              INDEX users_email_idx (email),
              INDEX users_created_idx ("createdAt")
            )
          `,
          },
        ],
      };

      // Should throw by default
      expect(() => diffSchemas([UsersTable], dbSchema)).toThrow(
        'Index "users_email_idx" has been modified. The uniqueness constraint has changed from false to true. Please create a new index with the desired uniqueness constraint and drop the old one.'
      );

      // Should allow modification with options
      const diff = diffSchemas([UsersTable], dbSchema, {
        indexModifications: { allowModifications: true },
      });
      expect(diff.modifiedTables).toHaveLength(1);
      const tableDiff = diff.modifiedTables[0];
      expect(tableDiff.modifiedIndexes).toContainEqual(
        expect.objectContaining({
          dbUnique: false,
          schemaUnique: true,
          name: 'users_email_idx',
        })
      );
    });

    it('should handle missing and extra indexes without throwing', () => {
      interface UserSchema {
        id: string;
        email: string;
        name: string;
      }
      const db = createDb({
        runQueriesInTransaction: async () => {},
        query: async () => [],
        discriminator: createDbDiscriminator('test'),
        getQueryBuilderIndexes: () =>
          Promise.resolve({ queryBuilderIndexes: {} }),
        defaultSchema: 'custom_schema',
      });
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
            email_idx: index(table.email),
          }))
          .introspect({
            columns: 'enforce',
            indexes: 'enforce',
          })
          .build();
      }

      // Mock database schema with extra index
      const dbSchema: FastSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 1,
                hidden: false,
              },
              {
                name: 'email',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 2,
                hidden: false,
              },
              {
                name: 'name',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 3,
                hidden: false,
              },
            ],
            indexes: [
              {
                name: 'users_name_idx',
                unique: false,
                parts: [
                  {
                    expression: '"name"',
                    direction: 'ASC',
                    position: 1,
                    storing: false,
                  },
                ],
                includeColumns: [],
              },
            ],
            createStatement: `
            CREATE TABLE public.users (
              id VARCHAR NOT NULL,
              email VARCHAR NOT NULL,
              name VARCHAR NOT NULL,
              PRIMARY KEY (id),
              INDEX users_name_idx (name)
            )
          `,
          },
        ],
      };

      // Should work the same with or without options
      const diff = diffSchemas([UsersTable], dbSchema);
      const diffWithOptions = diffSchemas([UsersTable], dbSchema, {
        indexModifications: { allowModifications: true },
      });

      for (const d of [diff, diffWithOptions]) {
        expect(d.modifiedTables).toHaveLength(1);
        const tableDiff = d.modifiedTables[0];

        // Should detect missing index
        expect(tableDiff.missingIndexes).toHaveLength(1);
        expect(tableDiff.missingIndexes[0].name).toBe('users_email_idx');

        // Should detect extra index
        expect(tableDiff.extraIndexes).toHaveLength(1);
        expect(tableDiff.extraIndexes[0].name).toBe('users_name_idx');
      }
    });
  });

  describe('Schema Qualification', () => {
    it('should handle schema-qualified table names', () => {
      interface UserSchema {
        id: string;
        name: string;
      }
      const db = createDb({
        runQueriesInTransaction: async () => {},
        query: async () => [],
        discriminator: createDbDiscriminator('test'),
        getQueryBuilderIndexes: () =>
          Promise.resolve({ queryBuilderIndexes: {} }),
        defaultSchema: 'custom_schema',
      });

      class UsersTable {
        static readonly Table = db
          .buildTableFromSchema<UserSchema>()
          .columns({
            id: (_) => _.varchar(),
            name: (_) => _.varchar(),
          })
          .primaryKey('id')
          .tableName('users')
          .schema('custom')
          .defaultAlias('users')
          .introspect({
            columns: 'enforce',
            indexes: 'enforce',
          })
          .build();
      }

      // Mock database schema with schema-qualified table
      const dbSchema: FastSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 1,
                hidden: false,
              },
              {
                name: 'name',
                type: 'character varying',
                udt: '_varchar',
                nullable: false,
                defaultValue: null,
                ordinalPosition: 2,
                hidden: false,
              },
            ],
            indexes: [],
            createStatement: `
            CREATE TABLE custom.users (
              id VARCHAR NOT NULL,
              name VARCHAR NOT NULL,
              PRIMARY KEY (id)
            )
          `,
          },
        ],
      };

      // Should not detect any differences
      const diff = diffSchemas([UsersTable], dbSchema);
      expect(diff.modifiedTables).toHaveLength(0);
    });
  });
});
