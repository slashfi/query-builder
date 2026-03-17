import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';

interface TestSchemaTable {
  name: string;
  description: string | null;
}

const testSym = createDbDiscriminator('test');
const db = createDb({
  runQueriesInTransaction: async () => {},
  query: async () => [],
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

class TestTable {
  static readonly Table = db
    .buildTableFromSchema<TestSchemaTable>()
    .columns({
      name: (_) => _.varchar(),
      description: (_) => _.varchar().isNullable(),
    })
    .primaryKey('name')
    .tableName('test_table')
    .defaultAlias('test')
    .build();
}

describe('ilike operator', () => {
  it('should generate correct SQL for ilike operation', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) => _.test.name.ilike('%test%'))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toContain('ILIKE');
    expect(query).toContain('$1');
    expect(params).toEqual(['%test%']);
  });

  it('should work with nullable columns', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) => _.test.description.ilike('%description%'))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toContain('ILIKE');
    expect(query).toContain('$1');
    expect(params).toEqual(['%description%']);
  });

  it('should work with expression builders', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) =>
        _.test.name.ilike('%test%').and(_.test.description.ilike('%desc%'))
      )
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toContain('ILIKE');
    expect(query).toContain('$1');
    expect(query).toContain('$2');
    expect(params).toEqual(['%test%', '%desc%']);
  });

  it('should generate different SQL than like operator', () => {
    const ilikeSqlString = db
      .from(TestTable)
      .where((_) => _.test.name.ilike('%test%'))
      .getSqlString();

    const likeSqlString = db
      .from(TestTable)
      .where((_) => _.test.name.like('%test%'))
      .getSqlString();

    const ilikeQuery = ilikeSqlString.getQuery();
    const likeQuery = likeSqlString.getQuery();

    expect(ilikeQuery).toContain('ILIKE');
    expect(likeQuery).toContain('LIKE');
    expect(ilikeQuery).not.toContain(' LIKE ');
    expect(likeQuery).not.toContain('ILIKE');
  });
});
