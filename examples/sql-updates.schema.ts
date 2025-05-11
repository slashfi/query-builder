import { createDb, createDbDiscriminator } from '@slashfi/query-builder';
import type { SqlString } from '@slashfi/query-builder/sql-string';

export interface UpdateTestSchema {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  count: number;
  tags: string[] | undefined;
  metadata: {
    createdAt: string;
    updatedAt: string | undefined;
  };
  created_at: Date;
}

export const queryExecutor = {
  query: async (_queryName: string, _sqlString: SqlString) => [],
  resetQueryExecutor: () => {
    Object.assign(queryExecutor, {
      query: async () => [],
    });
  },
};

export const db = createDb({
  discriminator: createDbDiscriminator('update_test'),
  query: async (queryName: string, sqlString: SqlString) => {
    return queryExecutor.query(queryName, sqlString);
  },
  runQueriesInTransaction: async () => {},
  getQueryBuilderIndexes: () => import('./generated/types'),
});

export class UpdateTestTable {
  static readonly Table = db
    .buildTableFromSchema<UpdateTestSchema>()
    .tableName('update_test')
    .columns({
      id: (_) => _.varchar(),
      name: (_) => _.varchar(),
      status: (_) => _.varchar(),
      count: (_) => _.int(),
      tags: (_) => _.array({ isNullable: true, baseType: 'varchar' }),
      metadata: (_) => _.json(),
      created_at: (_) => _.timestamp(),
    })
    .primaryKey('id')
    .defaultAlias('updateTest')
    .indexes(({ table, index }) => ({
      // Regular non-strict index
      by_name: index(table.name),

      // Strict index with single column
      by_status_strict: index(table.status),

      // Unique index
      by_id: index(table.id).unique(),

      // Composite strict index
      by_name_status_strict: index(table.name, table.status),

      // Composite non-strict index with storing
      by_count_name: index(table.count, table.name).storing(table.tags),

      // Partial index for non-zero count
      by_non_zero_count_with_name: index(table.name)
        .where(table.count.notEquals(0))
        .storing(table.count),
    }))
    .introspect()
    .build();

  static readonly idx = db.indexConfig(UpdateTestTable, {
    // Regular non-strict index (allows custom select)
    by_name: {
      columns: {
        name: {
          operations: ['eq', 'in'],
        },
      },
      strict: { columnsOnly: false },
    },

    // Strict index (no custom select)
    by_status_strict: {
      columns: {
        status: {
          operations: ['eq'],
        },
      },
    },

    // Unique index (allows custom select)
    by_id: {
      columns: {
        id: {
          operations: ['eq'],
        },
      },
      strict: { columnsOnly: false },
    },

    // Composite strict index (no custom select)
    by_name_status_strict: {
      columns: {
        name: {
          operations: ['eq'],
        },
        status: {
          operations: ['eq'],
        },
      },
    },

    // Composite non-strict index with storing (allows custom select)
    by_count_name: {
      columns: {
        count: {
          operations: ['eq', 'gt', 'lt'],
        },
        name: {
          operations: ['eq'],
        },
      },
      strict: { columnsOnly: false },
    },

    // Partial index for non-zero count
    by_non_zero_count_with_name: {
      columns: {
        name: {
          operations: ['eq', 'in'],
        },
      },
      strict: { columnsOnly: false },
    },
  });
}
