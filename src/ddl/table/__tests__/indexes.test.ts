import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../../../db-helper';

const testSym = createDbDiscriminator('test');

const expectEqual = <const T>(a: T, b: NoInfer<T>) => expect(a).toEqual(b);

describe('Indexes', () => {
  it('Should represent index & index names properly (both named and unnamed)', () => {
    interface UserSchema {
      id: string;
      email: string;
      createdAt: Date;
    }
    const db = createDb({
      query: async () => [],
      runQueriesInTransaction: async () => {},
      discriminator: testSym,
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
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
        .defaultAlias('users')
        // purposefully declaring tableName after
        .tableName('users')
        .indexes((_) => ({
          by_email: _.index(_.table.email),
          by_created_at_with_custom_name: _.index(_.table.createdAt).name(
            'users_custom_created_at'
          ),
        }))
        .introspect({
          columns: 'enforce',
          indexes: 'enforce',
        })
        .build();
    }

    const expectedEmailIndexName = 'users_by_email';
    const expectedCreatedAtIndexName = 'users_custom_created_at';

    expectEqual(UsersTable.Table.indexes.by_email.name, expectedEmailIndexName);
    expectEqual(
      UsersTable.Table.indexes.by_created_at_with_custom_name.name,
      expectedCreatedAtIndexName
    );
  });

  it("If no indexes are defined, the table's indexes property should be undefined", () => {
    interface UserSchema {
      id: string;
      email: string;
      createdAt: Date;
    }
    const db = createDb({
      query: async () => [],
      runQueriesInTransaction: async () => {},
      discriminator: testSym,
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
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
        .defaultAlias('users')
        // purposefully declaring tableName after
        .tableName('users')
        .introspect({
          columns: 'enforce',
          indexes: 'enforce',
        })
        .build();
    }

    expectEqual(UsersTable.Table.indexes, undefined);
  });
});
