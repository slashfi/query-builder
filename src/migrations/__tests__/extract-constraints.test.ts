import { describe, expect, it } from 'vitest';
import type { BaseDbDiscriminator } from '../../base';
import { createDb, createDbDiscriminator } from '../../db-helper';
import type { Config } from '../../introspection/config';
import type { FastSchema } from '../../introspection/introspect-schema';
import type { IntrospectionResult } from '../../introspection/schema-diff';
import { extractConstraints } from '../extract-constraints';

describe('extractConstraints', () => {
  const testSym = createDbDiscriminator('test');

  const emptyConfig: Config = {
    database: {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      database: 'test',
    },
    patterns: [],
    migrationsDir: 'migrations',
  };

  const emptySchema: FastSchema = {
    tables: [],
  };

  it('extracts constraints from modified columns', () => {
    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
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
                type: {
                  db: 'varchar',
                  schema: 'text',
                },
                nullable: {
                  db: false,
                  schema: true,
                },
              },
            ],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      },
      diffOutput: '',
      migrations: {
        up: [],
        down: [],
      },
      config: emptyConfig,
      schemas: [],
      dbSchema: emptySchema,
    };

    const constraints = extractConstraints(result);

    expect(constraints).toEqual({
      users: {
        must_exist: true,
        columns: {
          email: {
            type: 'varchar',
            nullable: false,
          },
        },
        indexes: {},
      },
    });
  });

  it('extracts constraints from extra columns being dropped', () => {
    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [
              {
                name: 'old_column',
                type: {
                  db: 'integer',
                },
                nullable: {
                  db: true,
                },
              },
            ],
            modifiedColumns: [],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      },
      diffOutput: '',
      migrations: {
        up: [],
        down: [],
      },
      config: emptyConfig,
      schemas: [],
      dbSchema: emptySchema,
    };

    const constraints = extractConstraints(result);

    expect(constraints).toEqual({
      users: {
        must_exist: true,
        columns: {
          old_column: {
            type: 'integer',
            nullable: true,
          },
        },
        indexes: {},
      },
    });
  });

  it('extracts constraints from modified indexes when indexSyncMode is full', () => {
    const db = createDb({
      query: async () => [],
      runQueriesInTransaction: async () => {},
      discriminator: testSym,
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
    });
    const usersTable = db
      .buildTableFromSchema<{
        id: number;
        email: string;
        name: string;
      }>()
      .tableName('users')
      .defaultAlias('u')
      .primaryKey('id')
      .columns({
        id: (qb) => qb.int(),
        email: (qb) => qb.varchar(),
        name: (qb) => qb.varchar(),
      })
      .introspect({
        columns: 'enforce',
        indexes: 'enforce',
        indexSyncMode: 'full',
      })
      .build();

    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
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
            modifiedIndexes: [
              {
                name: 'idx_email',
                schemaExpressions: ['email'],
                dbExpressions: ['lower(email)'],
              },
            ],
          },
        ],
      },
      diffOutput: '',
      migrations: {
        up: [],
        down: [],
      },
      config: emptyConfig,
      schemas: [{ Table: usersTable }],
      dbSchema: emptySchema,
    };

    const constraints = extractConstraints(result);

    expect(constraints).toEqual({
      users: {
        must_exist: true,
        columns: {},
        indexes: {
          idx_email: {
            must_exist: true,
          },
        },
      },
    });
  });

  it('does not extract index constraints when indexSyncMode is additive', () => {
    const db = createDb({
      query: async () => [],
      runQueriesInTransaction: async () => {},
      discriminator: testSym,
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
    });
    const usersTable = db
      .buildTableFromSchema<{
        id: number;
        email: string;
        name: string;
      }>()
      .columns({
        id: (qb) => qb.int(),
        email: (qb) => qb.varchar(),
        name: (qb) => qb.varchar(),
      })
      .tableName('users')
      .defaultAlias('u')
      .primaryKey('id')
      .introspect({
        columns: 'enforce',
        indexes: 'enforce',
        indexSyncMode: 'additive',
      })
      .build();

    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [],
            modifiedColumns: [],
            missingIndexes: [],
            extraIndexes: [
              {
                name: 'idx_email',
                dbExpressions: ['email'],
                dbUnique: false,
              },
            ],
            modifiedIndexes: [
              {
                name: 'idx_name',
                schemaExpressions: ['name'],
                dbExpressions: ['lower(name)'],
              },
            ],
          },
        ],
      },
      diffOutput: '',
      migrations: {
        up: [],
        down: [],
      },
      config: emptyConfig,
      schemas: [{ Table: usersTable }],
      dbSchema: emptySchema,
    };

    const constraints = extractConstraints(result);

    expect(constraints).toEqual({
      users: {
        must_exist: true,
        columns: {},
        indexes: {}, // No index constraints when in additive mode
      },
    });
  });

  it('extracts constraints from primary key changes', () => {
    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
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
              db: ['id'],
              schema: ['id', 'tenant_id'],
            },
          },
        ],
      },
      diffOutput: '',
      migrations: {
        up: [],
        down: [],
      },
      config: emptyConfig,
      schemas: [],
      dbSchema: emptySchema,
    };

    const constraints = extractConstraints(result);

    expect(constraints).toEqual({
      users: {
        must_exist: true,
        columns: {
          id: {
            type: 'unknown',
            nullable: false,
          },
        },
        indexes: {},
      },
    });
  });

  it('handles multiple tables', () => {
    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [
              {
                name: 'old_column',
                type: { db: 'integer' },
                nullable: { db: true },
              },
            ],
            modifiedColumns: [],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
          {
            name: 'posts',
            missingColumns: [],
            extraColumns: [],
            modifiedColumns: [
              {
                name: 'title',
                type: {
                  db: 'varchar',
                  schema: 'text',
                },
                nullable: {
                  db: false,
                  schema: true,
                },
              },
            ],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      },
      diffOutput: '',
      migrations: {
        up: [],
        down: [],
      },
      config: emptyConfig,
      schemas: [],
      dbSchema: emptySchema,
    };

    const constraints = extractConstraints(result);

    expect(constraints).toEqual({
      users: {
        must_exist: true,
        columns: {
          old_column: {
            type: 'integer',
            nullable: true,
          },
        },
        indexes: {},
      },
      posts: {
        must_exist: true,
        columns: {
          title: {
            type: 'varchar',
            nullable: false,
          },
        },
        indexes: {},
      },
    });
  });
});
