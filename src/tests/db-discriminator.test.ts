import { describe, expect, it } from 'vitest';
import { constantForBoolean } from '../constants/constant-for-boolean';
import { createDb, createDbDiscriminator } from '../db-helper';

describe('db discriminator', () => {
  it('prevents using tables from one db with another', () => {
    // Create two different db instances with unique discriminators
    const db1Discriminator = createDbDiscriminator('db1');
    const db2Discriminator = createDbDiscriminator('db2');

    const db1 = createDb({
      runQueriesInTransaction: async () => {},
      discriminator: db1Discriminator,
      query: async () => [],
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
    });

    const db2 = createDb({
      runQueriesInTransaction: async () => {},
      discriminator: db2Discriminator,
      query: async () => [],
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
    });

    // Define table classes for db1
    class Users1 {
      static Table = db1
        .buildTableFromSchema<{
          id: number;
          name: string;
        }>()
        .tableName('users')
        .defaultAlias('u')
        .columns({
          id: (t) => t.int(),
          name: (t) => t.varchar(),
        })
        .primaryKey('id')
        .build();
    }

    class Posts1 {
      static Table = db1
        .buildTableFromSchema<{
          id: number;
          userId: number;
          title: string;
        }>()
        .tableName('posts')
        .defaultAlias('p')
        .columns({
          id: (t) => t.int(),
          userId: (t) => t.int(),
          title: (t) => t.varchar(),
        })
        .primaryKey('id')
        .build();
    }

    // Define table classes for db2
    class Users2 {
      static Table = db2
        .buildTableFromSchema<{
          id: number;
          name: string;
        }>()
        .tableName('users')
        .defaultAlias('u')
        .columns({
          id: (t) => t.int(),
          name: (t) => t.varchar(),
        })
        .primaryKey('id')
        .build();
    }

    class Posts2 {
      static Table = db2
        .buildTableFromSchema<{
          id: number;
          userId: number;
          title: string;
        }>()
        .tableName('posts')
        .defaultAlias('p')
        .columns({
          id: (t) => t.int(),
          userId: (t) => t.int(),
          title: (t) => t.varchar(),
        })
        .primaryKey('id')
        .build();
    }

    // Register tables with their respective dbs
    db1.register(Users1);
    db1.register(Posts1);
    db2.register(Users2);
    db2.register(Posts2);

    // These should work - using tables with their own db
    expect(() => {
      db1.from(Users1);
    }).not.toThrow();

    expect(() => {
      db2.from(Users2);
    }).not.toThrow();

    expect(() => {
      db1.insert(Users1);
    }).not.toThrow();

    expect(() => {
      db2.insert(Users2);
    }).not.toThrow();

    // @ts-expect-error - Cannot use db2's table with db1
    const shouldNotCompile1 = () => db1.from(Users2);

    // @ts-expect-error - Cannot use db1's table with db2
    const shouldNotCompile2 = () => db2.from(Users1);

    // @ts-expect-error - Cannot use db2's table with db1
    const shouldNotCompile3 = () => db1.insert(Users2);

    // @ts-expect-error - Cannot use db1's table with db2
    const shouldNotCompile4 = () => db2.insert(Users1);

    // Prevent dead code elimination
    expect(shouldNotCompile1).toBeDefined();
    expect(shouldNotCompile2).toBeDefined();
    expect(shouldNotCompile3).toBeDefined();
    expect(shouldNotCompile4).toBeDefined();
  });

  it('prevents mixing tables from different dbs in joins', () => {
    const db1Discriminator = createDbDiscriminator('db1');
    const db2Discriminator = createDbDiscriminator('db2');

    const db1 = createDb({
      runQueriesInTransaction: async () => {},
      discriminator: db1Discriminator,
      query: async () => [],
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
    });

    const db2 = createDb({
      runQueriesInTransaction: async () => {},
      discriminator: db2Discriminator,
      query: async () => [],
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
    });

    // Define table classes for db1
    class Users1 {
      static Table = db1
        .buildTableFromSchema<{
          id: number;
          name: string;
        }>()
        .tableName('users')
        .defaultAlias('u')
        .columns({
          id: (t) => t.int(),
          name: (t) => t.varchar(),
        })
        .primaryKey('id')
        .build();
    }

    class Posts1 {
      static Table = db1
        .buildTableFromSchema<{
          id: number;
          userId: number;
          title: string;
        }>()
        .tableName('posts')
        .defaultAlias('p')
        .columns({
          id: (t) => t.int(),
          userId: (t) => t.int(),
          title: (t) => t.varchar(),
        })
        .primaryKey('id')
        .build();
    }

    // Define table class for db2
    class Posts2 {
      static Table = db2
        .buildTableFromSchema<{
          id: number;
          userId: number;
          title: string;
        }>()
        .tableName('posts')
        .defaultAlias('p')
        .columns({
          id: (t) => t.int(),
          userId: (t) => t.int(),
          title: (t) => t.varchar(),
        })
        .primaryKey('id')
        .build();
    }

    db1.register(Users1);
    db1.register(Posts1);
    db2.register(Posts2);

    // This should work - joining tables from the same db
    expect(() => {
      db1.from(Users1).leftJoin(Posts1, {
        on: (qb) => qb.u.id.equals(qb.p.userId),
      });
    }).not.toThrow();

    const shouldNotCompile = () =>
      db1
        .from(Users1)
        // @ts-expect-error - Cannot join tables from different dbs
        .leftJoin(Posts2, {
          on: () => constantForBoolean.create(true),
        });

    // Prevent dead code elimination
    expect(shouldNotCompile).toBeDefined();
  });
});
