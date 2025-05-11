import { describe, expect, it } from 'vitest';
import { createDataTypeVarchar } from '..';
import { createDb, createDbDiscriminator } from '../db-helper';

interface CustomSchemaTable {
  id: string;
  value: string;
}

const testSym = createDbDiscriminator('test');
const db = createDb({
  runQueriesInTransaction: async () => {},
  query: async () => [],
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

class MainTable {
  static readonly Table = db
    .buildTableFromSchema<CustomSchemaTable>()
    .columns({
      id: (_) => _.varchar(),
      value: (_) => _.varchar(),
    })
    .primaryKey('id')
    .tableName('main_table')
    .schema('custom')
    .defaultAlias('main')
    .build();
}

class JoinedTable {
  static readonly Table = db
    .buildTableFromSchema<CustomSchemaTable>()
    .columns({
      id: (_) => _.varchar(),
      value: (_) => _.varchar(),
    })
    .primaryKey('id')
    .tableName('joined_table')
    .schema('other_schema')
    .defaultAlias('joined')
    .build();
}

describe('Schema handling', () => {
  it('should use correct schema in left join', () => {
    const sqlString = db
      .from(MainTable)
      .leftJoin(JoinedTable, {
        on: (_) => _.main.id.equals(_.joined.id),
      })
      .getSqlString();

    const query = sqlString.getQuery();

    // Verify main table uses custom schema
    expect(query).toContain('"custom"."main_table"');

    // Verify joined table uses other_schema
    expect(query).toContain('"other_schema"."joined_table"');
  });

  it('should not add schema to VALUES table', () => {
    const values = db
      .values({
        id: createDataTypeVarchar({ isNullable: false }),
        value: createDataTypeVarchar({ isNullable: false }),
      })
      .rows({ id: '1', value: 'test1' }, { id: '2', value: 'test2' })
      .withAlias('vals');

    const sqlString = db
      .from(MainTable)
      .leftJoin(values, {
        on: (_) => _.main.id.equals(_.vals.id),
      })
      .getSqlString();

    const query = sqlString.getQuery();

    // Verify main table still uses custom schema
    expect(query).toContain('"custom"."main_table"');

    // Log the full query to inspect VALUES table format
    console.log(query);

    // Verify VALUES table doesn't have a schema prefix
    expect(query).not.toContain('"public"."vals"');
    expect(query).not.toContain('."vals"');
    // The VALUES table should appear directly in a VALUES clause
    expect(query).toContain('VALUES');
  });
});
