import {
  createDb,
  createDbDiscriminator,
} from '@slashfi/query-builder/db-helper';
import type { SqlString } from '@slashfi/query-builder/sql-string';

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
  query: async (_manager: unknown, queryName: string, sqlString: SqlString) => {
    return queryExecutor.query(queryName, sqlString);
  },
  runQueriesInTransaction: async () => {},
  discriminator: testSym,
  getQueryBuilderIndexes: () => import('./generated/types'),
});

export interface TestItemSchema {
  id: string;
  name: string;
  status: string | undefined;
  count: number | undefined;
  metadata:
    | {
        createdAt: string;
        updatedAt: string;
      }
    | undefined;
  created_at: Date;
}

export class TestItemsTable {
  static readonly Table = db
    .buildTableFromSchema<TestItemSchema>()
    .tableName('test_items')
    .columns({
      id: (_) => _.varchar(),
      name: (_) => _.varchar(),
      status: (_) => _.varchar({ isNullable: true }),
      count: (_) => _.int({ isNullable: true }),
      metadata: (_) => _.json({ isNullable: true }),
      created_at: (_) => _.timestamp(),
    })
    .primaryKey('id')
    .defaultAlias('testItems')
    .indexes(({ table, index }) => ({
      by_name: index(table.name).unique(),
      by_status_strict: index(table.status),
      by_count_name: index(table.count, table.name).storing(table.status),
      by_non_null_count_with_name: index(table.name)
        .where(table.count.isNotNull())
        .storing(table.status),
    }))
    .introspect()
    .build();

  static readonly idx = db.indexConfig(this, {
    by_count_name: {
      minimumSufficientColumns: ['count', 'name'],
    },
    by_name: {
      strict: { columnsOnly: false },
    },
    by_count_partial: {
      strict: { columnsOnly: true },
    },
  });
}
