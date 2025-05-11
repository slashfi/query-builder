import { createDb, createDbDiscriminator } from '@slashfi/query-builder';
import { queryBuilderIndexes } from './generated/types';

interface TestSchema {
  id: string;
  stringField: string;
  numberField: number;
  nullableBoolean: boolean | undefined;
  arr: ('a' | 'b' | 'c')[] | undefined;
  nullableString: string | undefined;
}

const db = createDb({
  discriminator: createDbDiscriminator('test'),
  query: async () => [],
  getQueryBuilderIndexes: async () => ({ queryBuilderIndexes }),
});

export class TestSchemaTable {
  static readonly Table = db
    .buildTableFromSchema<TestSchema>()
    .columns({
      id: (_) => _.varchar(),
      nullableBoolean: (_) => _.boolean({ isNullable: true }),
      numberField: (_) => _.int(),
      stringField: (_) => _.varchar(),
      arr: (_) => _.array({ isNullable: true, baseType: 'varchar' }),
      nullableString: (_) => _.varchar({ isNullable: true }),
    })
    .primaryKey('id')
    .tableName('test_schema')
    .schema('test')
    .defaultAlias('testSchema')
    .indexes(({ table, index }) => ({
      // Simple index
      stringField_idx: index(table.stringField),
      // Composite index with storing
      number_string_idx: index(table.numberField, table.stringField).storing(
        table.nullableString
      ),
      // Partial index
      bool_idx: index(table.nullableBoolean).where(
        table.nullableBoolean.isNotNull()
      ),
    }))
    .build();

  // Configure index behavior
  static readonly idx = db.indexConfig(TestSchemaTable, {
    // Composite index with storing
    number_string_idx: {
      minimumSufficientColumns: ['numberField', 'stringField'],
    },
    // Partial index
    bool_idx: {
      columns: {
        nullableBoolean: {
          operations: ['eq'],
        },
      },
    },
  });
}
