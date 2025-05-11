import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';

interface TestTable {
  id: string;
  value: string;
}

describe('DB Schema handling', () => {
  it('should use discriminator schema for all tables when not explicitly specified', () => {
    // Create a db with custom schema discriminator
    const db = createDb({
      runQueriesInTransaction: async () => {},
      query: async () => [],
      discriminator: createDbDiscriminator('test'),
      getQueryBuilderIndexes: () =>
        Promise.resolve({ queryBuilderIndexes: {} }),
      defaultSchema: 'custom_schema',
    });

    // Create two tables without specifying schema
    class Table1 {
      static readonly Table = db
        .buildTableFromSchema<TestTable>()
        .columns({
          id: (_) => _.varchar(),
          value: (_) => _.varchar(),
        })
        .primaryKey('id')
        .tableName('table1')
        .defaultAlias('t1')
        .build();
    }

    class Table2 {
      static readonly Table = db
        .buildTableFromSchema<TestTable>()
        .columns({
          id: (_) => _.varchar(),
          value: (_) => _.varchar(),
        })
        .primaryKey('id')
        .tableName('table2')
        .defaultAlias('t2')
        .build();
    }

    // Create a query joining both tables
    const sqlString = db
      .from(Table1)
      .leftJoin(Table2, {
        on: (_) => _.t1.id.equals(_.t2.id),
      })
      .getSqlString();

    const query = sqlString.getQuery();

    // Both tables should use the custom schema
    expect(query).toContain('"custom_schema"."table1"');
    expect(query).toContain('"custom_schema"."table2"');

    // Create a third table with explicit schema override
    class Table3 {
      static readonly Table = db
        .buildTableFromSchema<TestTable>()
        .columns({
          id: (_) => _.varchar(),
          value: (_) => _.varchar(),
        })
        .primaryKey('id')
        .tableName('table3')
        .schema('other_schema') // Explicitly override schema
        .defaultAlias('t3')
        .build();
    }

    // Create a query with all three tables
    const sqlString2 = db
      .from(Table1)
      .leftJoin(Table2, {
        on: (_) => _.t1.id.equals(_.t2.id),
      })
      .leftJoin(Table3, {
        on: (_) => _.t1.id.equals(_.t3.id),
      })
      .getSqlString();

    const query2 = sqlString2.getQuery();

    // First two tables should use custom schema, third should use explicit schema
    expect(query2).toContain('"custom_schema"."table1"');
    expect(query2).toContain('"custom_schema"."table2"');
    expect(query2).toContain('"other_schema"."table3"');
  });
});
