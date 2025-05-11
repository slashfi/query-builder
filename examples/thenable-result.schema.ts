import { createDb, createDbDiscriminator } from '@slashfi/query-builder';

export interface ThenableTestSchema {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  count: number;
  tags: string[] | undefined;
  metadata: {
    createdAt: string;
    updatedAt: string | undefined;
  };
}

export const db = createDb({
  discriminator: createDbDiscriminator('thenable_test'),
  query: async () => [],
  getQueryBuilderIndexes: () => import('./generated/types'),
});

export class ThenableTestTable {
  static readonly Table = db
    .buildTableFromSchema<ThenableTestSchema>()
    .tableName('thenable_test')
    .columns({
      id: (_) => _.varchar(),
      name: (_) => _.varchar(),
      status: (_) => _.varchar(),
      count: (_) => _.int(),
      tags: (_) => _.array({ isNullable: true, baseType: 'varchar' }),
      metadata: (_) => _.json(),
    })
    .primaryKey('id')
    .defaultAlias('thenableTest')
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
    }))
    .build();

  static readonly idx = db.indexConfig(ThenableTestTable, {
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
  });
}
