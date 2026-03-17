import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';
import { createFrom } from '../from-builder';
import { cast } from '../functions/cast';

interface JsonBTestSchema {
  id: string;
  myField: {
    a: number;
    b: string;
    nested: {
      a: boolean;
      c: string[];
      isNull: {
        hi: string;
      };
    };
  };
  nullableField:
    | {
        a: number;
      }
    | undefined;
}
const testSym = createDbDiscriminator('test');
const db = createDb({
  runQueriesInTransaction: async () => {},
  query: async () => [],
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

class JsonBTest {
  static readonly Table = db
    .buildTableFromSchema<JsonBTestSchema>()
    .columns({
      id: (_) => _.varchar(),
      myField: (_) => _.json(),
      nullableField: (_) => _.json({ isNullable: true }),
    })
    .primaryKey('id')
    .tableName('jsonb_test')
    .defaultAlias('jsonbTest')
    .build();
}

describe('JsonB', function () {
  it('isNull should be able to be applied to a nullable jsonb column', function () {
    const from = createFrom({
      query: () => Promise.resolve([]),
      discriminator: testSym,
    });

    const sqlString = from(JsonBTest)
      .where((_) => _.jsonbTest.nullableField.isNull())
      .getSqlString();

    expect(sqlString.getQuery()).toEqual(
      `SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."myField" AS "jsonbTest_myField", "jsonbTest"."nullableField" AS "jsonbTest_nullableField" FROM "public"."jsonb_test"  AS "jsonbTest"  WHERE "jsonbTest"."nullableField" IS NULL`
    );
  });
  it('can be cast any child of a jsonb column to a non-jsonb column', function () {
    const from = createFrom({
      query: () => Promise.resolve([]),
      discriminator: testSym,
    });

    const sqlString = from(JsonBTest)
      .where((_) =>
        cast(
          _.jsonbTest.myField.accessStringPath((_) => _.a),
          'int'
        ).equals(1)
      )
      .getSqlString();

    expect(sqlString.getQuery()).toEqual(
      `SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."myField" AS "jsonbTest_myField", "jsonbTest"."nullableField" AS "jsonbTest_nullableField" FROM "public"."jsonb_test"  AS "jsonbTest"  WHERE CAST("jsonbTest"."myField"->>$1 AS int) = $2`
    );
    expect(sqlString.getParameters()).to.deep.equal(['a', 1]);
  });

  it('should be able to check isNull on any subfield of a jsonb column', function () {
    const from = createFrom({
      query: () => Promise.resolve([]),
      discriminator: testSym,
    });

    const sqlString = from(JsonBTest)
      .where((_) =>
        _.jsonbTest.myField.accessStringPath((_) => _.nested).isNull()
      )
      .getSqlString();

    expect(sqlString.getQuery()).toEqual(
      `SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."myField" AS "jsonbTest_myField", "jsonbTest"."nullableField" AS "jsonbTest_nullableField" FROM "public"."jsonb_test"  AS "jsonbTest"  WHERE "jsonbTest"."myField"->>$1 IS NULL`
    );
    expect(sqlString.getParameters()).to.deep.equal(['nested']);
  });

  it('should be able to check isNull on any subfield of a jsonb column (with cast)', function () {
    const from = createFrom({
      query: () => Promise.resolve([]),
      discriminator: testSym,
    });

    const sqlString = from(JsonBTest)
      .where((_) =>
        _.jsonbTest.myField.accessStringPath((_) => _.nested).isNull()
      )
      .getSqlString();

    expect(sqlString.getQuery()).toEqual(
      `SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."myField" AS "jsonbTest_myField", "jsonbTest"."nullableField" AS "jsonbTest_nullableField" FROM "public"."jsonb_test"  AS "jsonbTest"  WHERE "jsonbTest"."myField"->>$1 IS NULL`
    );
    expect(sqlString.getParameters()).to.deep.equal(['nested']);
  });
});
