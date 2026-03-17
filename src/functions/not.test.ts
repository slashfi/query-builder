import { compareTypes } from '../core-utils';
import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';
import { not } from './not';

interface INotTestTableSchema {
  id: string;
  isActive: boolean;
  name: string | null;
}

const testSym = createDbDiscriminator('test');
const db = createDb({
  query: async () => [],
  runQueriesInTransaction: async () => {},
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

class NotTestTable {
  static Table = db
    .buildTableFromSchema<INotTestTableSchema>()
    .tableName('not_test_table')
    .columns({
      id: (_) => _.varchar(),
      isActive: (_) => _.boolean(),
      name: (_) => _.varchar().isNullable(),
    })
    .defaultAlias('ntt')
    .primaryKey('id')
    .build();
}

describe('not tests', function () {
  it('should generate the correct NOT query with equals', function () {
    const query = db
      .from(NotTestTable)
      .select((_) => [_.ntt.id, _.ntt.name])
      .where((_) => not(_.ntt.isActive.equals(true)))
      .getSqlString();

    expect(query.getQuery()).toEqual(
      'SELECT "ntt"."id" as "ntt_id", "ntt"."name" as "ntt_name" FROM "public"."not_test_table"  AS "ntt"  WHERE ("ntt"."isActive" = $1) IS FALSE'
    );
    expect(query.getParameters()).toEqual([true]);
  });

  it('should generate the correct NOT query with ilike', function () {
    const query = db
      .from(NotTestTable)
      .select((_) => [_.ntt.id, _.ntt.name])
      .where((_) => not(_.ntt.name.ilike('%test%')))
      .getSqlString();

    expect(query.getQuery()).toEqual(
      'SELECT "ntt"."id" as "ntt_id", "ntt"."name" as "ntt_name" FROM "public"."not_test_table"  AS "ntt"  WHERE ("ntt"."name" ILIKE $1) IS FALSE'
    );
    expect(query.getParameters()).toEqual(['%test%']);
  });

  it('should generate the correct NOT query with isNull', function () {
    const query = db
      .from(NotTestTable)
      .select((_) => [_.ntt.id, _.ntt.name])
      .where((_) => not(_.ntt.name.isNull()))
      .getSqlString();

    expect(query.getQuery()).toEqual(
      'SELECT "ntt"."id" as "ntt_id", "ntt"."name" as "ntt_name" FROM "public"."not_test_table"  AS "ntt"  WHERE ("ntt"."name" IS NULL) IS FALSE'
    );
    expect(query.getParameters()).toEqual([]);
  });

  it('should allow the not function to return boolean type', async function () {
    const res = await db
      .from(NotTestTable)
      .select((_) => [_.ntt.id, _.ntt.name])
      .where((_) => not(_.ntt.isActive.equals(true)));

    compareTypes<{
      a: typeof res;
      b: { ntt_id: string; ntt_name: string | undefined }[];
    }>()
      .expect('a')
      .toBeEquivalent('b');
  });

  it('should work with complex nested conditions', function () {
    const query = db
      .from(NotTestTable)
      .select((_) => [_.ntt.id])
      .where((_) =>
        not(_.ntt.isActive.equals(true).and(_.ntt.name.ilike('%test%')))
      )
      .getSqlString();

    expect(query.getQuery()).toEqual(
      'SELECT "ntt"."id" as "ntt_id" FROM "public"."not_test_table"  AS "ntt"  WHERE (("ntt"."isActive" = $1) AND ("ntt"."name" ILIKE $2)) IS FALSE'
    );
    expect(query.getParameters()).toEqual([true, '%test%']);
  });

  it('should handle double negation not(not(expr))', function () {
    const query = db
      .from(NotTestTable)
      .select((_) => [_.ntt.id])
      .where((_) => not(not(_.ntt.isActive.equals(true))))
      .getSqlString();

    expect(query.getQuery()).toEqual(
      'SELECT "ntt"."id" as "ntt_id" FROM "public"."not_test_table"  AS "ntt"  WHERE (("ntt"."isActive" = $1) IS FALSE) IS FALSE'
    );
    expect(query.getParameters()).toEqual([true]);
  });
});
