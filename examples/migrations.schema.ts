import {
  createDb,
  createDbDiscriminator,
} from '@slashfi/query-builder/db-helper';
import type { SqlString } from '@slashfi/query-builder/sql-string';
import { sql } from '@slashfi/query-builder/sql-string';

const testSym = createDbDiscriminator('test');

const defaultQueryExecutor = async (
  _queryName: string,
  _sqlString: SqlString
) => {
  throw new Error('Query executor not implemented');
};

export const queryExecutor = {
  query: defaultQueryExecutor,
  resetQueryExecutor() {
    this.query = defaultQueryExecutor;
  },
};

export const db = createDb({
  query: async (queryName: string, sqlString: SqlString) => {
    return queryExecutor.query(queryName, sqlString);
  },
  runQueriesInTransaction: async () => {},
  discriminator: testSym,
  getQueryBuilderIndexes: () => import('./generated/types'),
});

export interface UserSchema {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date | undefined;
  last_login: Date | undefined;
  retry_count: number;
}

export class UsersTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .tableName('migration_users')
    .columns({
      id: (_) => _.varchar(),
      email: (_) => _.varchar(),
      created_at: (_) =>
        _.timestamp().default(sql`current_timestamp()`, {
          isOptionalForInsert: true,
        }),
      updated_at: (_) => _.timestamp({ isNullable: true }),
      last_login: (_) => _.timestamp({ isNullable: true }),
      retry_count: (_) => _.int().default(0, { isOptionalForInsert: true }),
    })
    .primaryKey('id')
    .defaultAlias('users')
    .introspect()
    .build();
}
