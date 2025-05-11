import { compareTypes } from '@/core-utils';
import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';
import { sum } from './sum';

interface ISumTestTableSchema {
  id: string;
  value: number;
}
const testSym = createDbDiscriminator('test');
const db = createDb({
  query: async () => [],
  runQueriesInTransaction: async () => {},
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});
class SumTestTable {
  static Table = db
    .buildTableFromSchema<ISumTestTableSchema>()
    .tableName('sum_test_table')
    .columns({
      id: (_) => _.varchar(),
      value: (_) => _.int(),
    })
    .defaultAlias('stt')
    .primaryKey('id')
    .build();
}

describe('sum tests', function () {
  it('should generate the correct SUM query', function () {
    const query = db
      .from(SumTestTable)
      .select((_) => [sum(_.stt.value)])
      .getSqlString();

    expect(query.getQuery()).toEqual(
      'SELECT SUM("stt"."value") FROM "public"."sum_test_table"  AS "stt" '
    );
  });

  it('should allow the sum to be nullable', async function () {
    const res = await db.from(SumTestTable).select((_) => [sum(_.stt.value)]);

    compareTypes<{ a: typeof res; b: { sum: number | undefined }[] }>()
      .expect('a')
      .toBeEquivalent('b');
  });
});
