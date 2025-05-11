import { compareTypes } from '@/core-utils';
import { describe, expect, it } from 'vitest';
import { constantInt, createDataTypeVarchar, createInsert, fns } from '..';
import type { DataTypeBoolean, DataTypeNull, DataTypeUnion } from '../DataType';
import { constantForArray } from '../constants/ConstantForArray';
import { createDb, createDbDiscriminator } from '../db-helper';
import { dataTypeToConstant } from '../expression-builder';
import { createFrom } from '../from-builder';

interface TestSchema {
  id: string;
  stringField: string;
  numberField: number;
  nullableBoolean: boolean | undefined;
  arr: ('a' | 'b' | 'c')[] | undefined;
  nullableString: string | undefined;
}

const testSym = createDbDiscriminator('test');
const db = createDb({
  query: async () => [],
  runQueriesInTransaction: async () => {},
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

class TestSchemaTable {
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
    .defaultAlias('testSchema')
    .build();
}

describe('TestSchema', () => {
  const insert = createInsert({
    query: () => Promise.resolve([]),
    discriminator: testSym,
  });

  it('initial', () => {
    db.from(TestSchemaTable).where((_) => {
      const dataType = _.testSchema.nullableBoolean._expression.dataType;

      compareTypes<{
        a: typeof dataType;
        b: DataTypeUnion<[DataTypeBoolean<boolean>, DataTypeNull]>;
      }>()
        .expect('a')
        .toBeEquivalent('b');

      return _.testSchema.nullableBoolean.equals(fns.nullValue());
    });

    const sqlString = db
      .from(TestSchemaTable)
      .where((_) => _.testSchema.id.equals('hello world'))
      .getSqlString();

    expect(sqlString.getQuery()).toBe(
      `SELECT "testSchema"."id" AS "testSchema_id", "testSchema"."nullableBoolean" AS "testSchema_nullableBoolean", "testSchema"."numberField" AS "testSchema_numberField", "testSchema"."stringField" AS "testSchema_stringField", "testSchema"."arr" AS "testSchema_arr", "testSchema"."nullableString" AS "testSchema_nullableString" FROM "public"."test_schema"  AS "testSchema"  WHERE "testSchema"."id" = $1`
    );
    expect(sqlString.getParameters()).to.deep.equal(['hello world']);
  });

  it('left joined columns should all be nullable', () => {
    db.from(TestSchemaTable)
      .leftJoin(TestSchemaTable, {
        alias: 't2',
        on: (_) => _.t2.id.equals(_.testSchema.id).and(_.t2.id.isNotNull()),
      })
      .where((_) => _.t2.id.isNull());
  });

  it('should allow null to be used in ifClauses', async () => {
    const res = await db
      .from(TestSchemaTable)
      .select((_) => [
        (() => {
          const a = fns.ifClause(_.testSchema.numberField.moreThan(2), {
            ifTrue: fns.nullValue(),
            ifFalse: _.testSchema.numberField,
          });

          return a;
        })(),
      ])
      .query();

    const ifValue = () => res.result[0].if;

    compareTypes<{ a: ReturnType<typeof ifValue>; b: number | undefined }>()
      .expect('a')
      .toBeEquivalent('b');
  });

  it('.equals should work on left joined entities', async () => {
    await db
      .from(TestSchemaTable)
      .leftJoin(TestSchemaTable, {
        alias: 't2',
        on: (_) => _.t2.id.equals(_.testSchema.id).and(_.t2.id.isNotNull()),
      })
      .where((_) => _.t2.nullableBoolean.equals(true))
      .query();
  });

  it('should work with doUpdateSet', async () => {
    await insert(TestSchemaTable)
      .values({
        stringField: 'hello world',
        arr: [],
        id: '',
        nullableBoolean: false,
        numberField: 1,
        nullableString: 'hello world',
      })
      .onConflict({
        columns: (_) => [_.id],
        doUpdateSet: {
          nullableBoolean: (_) =>
            fns.ifClause(_.testSchema.nullableBoolean.isNull(), {
              ifTrue: _.excluded.nullableBoolean,
              ifFalse: _.testSchema.nullableBoolean,
            }),
        },
      })
      .query();
  });

  it('should treat left joins as null', async () => {
    const res = await db
      .from(TestSchemaTable)
      .leftJoin(TestSchemaTable, {
        alias: 't2',
        on: (_) => _.t2.id.equals(_.testSchema.id).and(_.t2.id.isNotNull()),
      })
      .where((_) => _.t2.nullableBoolean.isNull())
      .query();

    const getItem = () => res.result[0];
    compareTypes<{ a: ReturnType<typeof getItem>['t2']; b: undefined }>()
      .expect('b')
      .toExtend('a');
  });

  it('should support COUNT with IF inside in SELECT query', async () => {
    const references = fns.ifClause(constantInt(1).equals(1), {
      ifTrue: constantInt<number>(1),
      ifFalse: constantInt<number>(0),
    })._expression.columnReferences;

    compareTypes<{ a: typeof references; b: [] }>()
      .expect('a')
      .toBeEquivalent('b');

    const res = await db
      .from(TestSchemaTable)
      .select((_) => [
        fns
          .count(
            fns.ifClause(_.testSchema.nullableBoolean.equals(false), {
              ifTrue: constantInt<number>(1),
              ifFalse: constantInt<number>(0),
            })
          )
          .as('test'),
      ])
      .groupBy((_) => [_.testSchema.id])
      .query();

    const getItem = () => res.result[0];

    compareTypes<{ a: ReturnType<typeof getItem>; b: { test: number } }>()
      .expect('a')
      .toBeEquivalent('b');
  });

  it('should support thenable and return the result without any aliases if there are no joins', async () => {
    const customFrom = createFrom({
      query: async () => [
        {
          testSchema_id: '',
          testSchema_nullableBoolean: false,
          testSchema_numberField: 1,
          testSchema_stringField: 'hello world',
          testSchema_arr: [],
          t2_id: null,
          t2_nullableBoolean: null,
          t2_numberField: null,
          t2_stringField: null,
          t2_arr: null,
        },
      ],
      discriminator: testSym,
    });
    const res = await customFrom(TestSchemaTable);

    expect(res).to.have.lengthOf(1);
    expect(res[0].id).to.exist;
  });
  it('should support thenable and return the result with any aliases if there are joins', async () => {
    const customFrom = createFrom({
      query: async () => [
        {
          testSchema_id: '',
          testSchema_nullableBoolean: false,
          testSchema_numberField: 1,
          testSchema_stringField: 'hello world',
          testSchema_arr: [],
          t2_id: null,
          t2_nullableBoolean: null,
          t2_numberField: null,
          t2_stringField: null,
          t2_arr: null,
        },
      ],
      discriminator: testSym,
    });
    const res = await customFrom(TestSchemaTable).leftJoin(TestSchemaTable, {
      alias: 't2',
      on: (_) => _.t2.id.equals(_.testSchema.id),
    });

    expect(res).to.have.lengthOf(1);
    expect(res[0].testSchema).to.exist;
  });

  it('should support limit with thenable return type', async () => {
    const customFrom = createFrom({
      query: async () => [{ testSchema_id: '' }],
      discriminator: testSym,
    });

    const res = await customFrom(TestSchemaTable).limit(1);

    compareTypes<{
      a: typeof res;
      b: [any | undefined];
    }>()
      .expect('a')
      .toBeEquivalent('b');
  });

  it('should omit the entire object from an expression select column if the joined table is null', async () => {
    const customFrom = createFrom({
      query: async () => [
        {
          testSchema_id: '',
          testSchema_nullableBoolean: false,
          testSchema_numberField: 1,
          testSchema_stringField: 'hello world',
          testSchema_arr: [],
          t2_id: null,
          t2_nullableBoolean: null,
          t2_numberField: null,
          t2_stringField: null,
          t2_arr: null,
        },
      ],
      discriminator: testSym,
    });

    const res = await customFrom(TestSchemaTable)
      .leftJoin(TestSchemaTable, {
        alias: 't2',
        on: (_) => _.t2.id.equals(_.testSchema.stringField),
      })
      .query();

    expect(res.result[0].t2).to.be.undefined;
  });

  it('should convert an insert response string to a number if the data type is an int', async () => {
    const customInsert = createInsert({
      query: () =>
        Promise.resolve([
          {
            id: '',
            nullableBoolean: false,
            numberField: '1',
            stringField: 'hello world',
            arr: [],
          },
        ]),
      discriminator: testSym,
    });

    const res = await customInsert(TestSchemaTable)
      .values({
        id: '',
        nullableBoolean: false,
        numberField: 1,
        stringField: 'hello world',
        arr: [],
        nullableString: 'hello world',
      })
      .returning('*')
      .query();

    expect(res.result[0].numberField).to.equal(1);
  });

  it('should correctly query values', async () => {
    const values = db
      .values({
        prompt: createDataTypeVarchar({ isNullable: false }),
      })
      .rows({ prompt: 'hello' }, { prompt: 'world' })
      .withAlias('hello_world');

    console.log(db.from(values).getSqlString());
  });

  it('should support where clauses in doUpdateSet', async () => {
    const res = insert(TestSchemaTable)
      .values({
        stringField: 'hello world',
        arr: [],
        id: '',
        nullableBoolean: false,
        numberField: 1,
        nullableString: 'hello world',
      })
      .onConflict({
        columns: (_) => [_.id],
        doUpdateSet: {
          nullableBoolean: (_) =>
            fns.ifClause(_.testSchema.nullableBoolean.isNull(), {
              ifTrue: _.excluded.nullableBoolean,
              ifFalse: _.testSchema.nullableBoolean,
            }),
        },
        where: (_) =>
          _.testSchema.numberField
            .equals(_.excluded.numberField)
            .and(_.testSchema.id.equals(_.excluded.id)),
      })
      .returning('*')
      .getSqlString();

    expect(
      res
        .getQuery()
        .includes(
          'WHERE ("testSchema"."numberField" = "excluded"."numberField") AND ("testSchema"."id" = "excluded"."id")'
        )
    ).to.be.true;
  });

  it('can insert arrays and query with correct type', async () => {
    const res = await insert(TestSchemaTable)
      .values({
        id: '',
        nullableBoolean: false,
        numberField: 1,
        stringField: 'hello world',
        arr: ['a', 'b'],
        nullableString: 'hello world',
      })
      .query();

    console.log(res.sql);

    const res2 = await db.from(TestSchemaTable);

    compareTypes<{ a: (typeof res2)[number]['arr']; b: TestSchema['arr'] }>()
      .expect('a')
      .toBeEquivalent('b');
  });

  it('performs implicit thenable with a custom SELECT clause', async () => {
    const customFrom = createFrom({
      query: async () => [
        {
          testSchema_id: '',
          testSchema_nullableBoolean: false,
          testSchema_numberField: 1,
          testSchema_stringField: 'hello world',
          testSchema_arr: [],
        },
      ],
      discriminator: testSym,
    });
    const res = await customFrom(TestSchemaTable).select((_) => [
      _.testSchema.id,
    ]);

    expect(res[0].testSchema_id).toBe('');
    compareTypes<{ a: typeof res; b: { testSchema_id: string }[] }>()
      .expect('a')
      .toBeEquivalent('b');
  });

  it('can LIKE on nullable column', async () => {
    // Making sure like doesn't resolve in never
    const { sql } = await db
      .from(TestSchemaTable)
      .where((_) => _.testSchema.nullableString.like('%x%'))
      .query();

    expect(sql.getQuery()).to.include(
      `WHERE "testSchema"."nullableString" LIKE $1`
    );

    expect(sql.getParameters()).to.deep.equal(['%x%']);
  });

  it('arrays should properly get constructed', () => {
    const dt = createDataTypeVarchar({ isNullable: false });

    const res = constantForArray.create(
      dt,
      ['a', 'b', 'c'].map((val) => dataTypeToConstant(dt, val))
    );

    const sql = constantForArray.writeSql(res);

    expect(sql.getQuery()).to.equal('ARRAY[$1,$2,$3]::VARCHAR[]');
    expect(sql.getParameters()).to.deep.equal(['a', 'b', 'c']);
  });
});
