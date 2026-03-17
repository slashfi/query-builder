import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';

interface TestSchemaTable {
  id: number;
  tags: string[];
  numbers: number[];
}

interface TestSchemaTableWithReadonly {
  id: number;
  tags: readonly string[];
  internalTags: readonly ('arman' | 'jason')[];
  permissions: readonly ('read' | 'write' | 'admin')[];
  roles: readonly ('user' | 'admin' | 'super_admin')[];
  numbers: readonly number[];
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
      id: (_) => _.int(),
      tags: (_) => _.array({ baseType: 'varchar' }),
      numbers: (_) => _.array({ baseType: 'int' }),
    })
    .primaryKey('id')
    .tableName('test_table')
    .defaultAlias('test')
    .build();
}

class TestTableWithReadonly {
  static readonly Table = db
    .buildTableFromSchema<TestSchemaTableWithReadonly>()
    .columns({
      id: (_) => _.int(),
      tags: (_) => _.array({ baseType: 'varchar' }),
      internalTags: (_) => _.array({ baseType: 'varchar' }),
      permissions: (_) => _.array({ baseType: 'varchar' }),
      roles: (_) => _.array({ baseType: 'varchar' }),
      numbers: (_) => _.array({ baseType: 'int' }),
    })
    .primaryKey('id')
    .tableName('test_readonly_table')
    .defaultAlias('testReadonly')
    .build();
}

describe('array contains operator', () => {
  it('should generate correct SQL for array contains operation', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) => _.test.tags.contains(['tag1', 'tag2']))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "test"."id" AS "test_id", "test"."tags" AS "test_tags", "test"."numbers" AS "test_numbers" FROM "public"."test_table"  AS "test"  WHERE "test"."tags" @> ARRAY[$1,$2]::VARCHAR[]'
    );
    expect(params).toEqual(['tag1', 'tag2']);
  });

  it('should work with number arrays', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) => _.test.numbers.contains([1, 2, 3]))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "test"."id" AS "test_id", "test"."tags" AS "test_tags", "test"."numbers" AS "test_numbers" FROM "public"."test_table"  AS "test"  WHERE "test"."numbers" @> ARRAY[$1,$2,$3]::INT[]'
    );
    expect(params).toEqual([1, 2, 3]);
  });

  it('should work with single element arrays', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) => _.test.tags.contains(['single-tag']))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "test"."id" AS "test_id", "test"."tags" AS "test_tags", "test"."numbers" AS "test_numbers" FROM "public"."test_table"  AS "test"  WHERE "test"."tags" @> ARRAY[$1]::VARCHAR[]'
    );
    expect(params).toEqual(['single-tag']);
  });

  it('should work with expression builders', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) =>
        _.test.tags.contains(['tag1']).and(_.test.numbers.contains([42]))
      )
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "test"."id" AS "test_id", "test"."tags" AS "test_tags", "test"."numbers" AS "test_numbers" FROM "public"."test_table"  AS "test"  WHERE ("test"."tags" @> ARRAY[$1]::VARCHAR[]) AND ("test"."numbers" @> ARRAY[$2]::INT[])'
    );
    expect(params).toEqual(['tag1', 42]);
  });

  it('should work with empty arrays', () => {
    const sqlString = db
      .from(TestTable)
      .where((_) => _.test.tags.contains([]))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "test"."id" AS "test_id", "test"."tags" AS "test_tags", "test"."numbers" AS "test_numbers" FROM "public"."test_table"  AS "test"  WHERE "test"."tags" @> ARRAY[]::VARCHAR[]'
    );
    expect(params).toEqual([]);
  });
});

describe('readonly array and union literal compatibility', () => {
  it('should work with readonly string arrays', () => {
    const sqlString = db
      .from(TestTableWithReadonly)
      .where((_) => _.testReadonly.tags.contains(['tag1', 'tag2']))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "testReadonly"."id" AS "testReadonly_id", "testReadonly"."tags" AS "testReadonly_tags", "testReadonly"."internalTags" AS "testReadonly_internalTags", "testReadonly"."permissions" AS "testReadonly_permissions", "testReadonly"."roles" AS "testReadonly_roles", "testReadonly"."numbers" AS "testReadonly_numbers" FROM "public"."test_readonly_table"  AS "testReadonly"  WHERE "testReadonly"."tags" @> ARRAY[$1,$2]::VARCHAR[]'
    );
    expect(params).toEqual(['tag1', 'tag2']);
  });

  it('should work with union literal arrays like internalTags', () => {
    const sqlString = db
      .from(TestTableWithReadonly)
      .where((_) => _.testReadonly.internalTags.contains(['arman', 'jason']))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "testReadonly"."id" AS "testReadonly_id", "testReadonly"."tags" AS "testReadonly_tags", "testReadonly"."internalTags" AS "testReadonly_internalTags", "testReadonly"."permissions" AS "testReadonly_permissions", "testReadonly"."roles" AS "testReadonly_roles", "testReadonly"."numbers" AS "testReadonly_numbers" FROM "public"."test_readonly_table"  AS "testReadonly"  WHERE "testReadonly"."internalTags" @> ARRAY[$1,$2]::VARCHAR[]'
    );
    expect(params).toEqual(['arman', 'jason']);
  });

  it('should work with permission arrays', () => {
    const sqlString = db
      .from(TestTableWithReadonly)
      .where((_) => _.testReadonly.permissions.contains(['read', 'write']))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "testReadonly"."id" AS "testReadonly_id", "testReadonly"."tags" AS "testReadonly_tags", "testReadonly"."internalTags" AS "testReadonly_internalTags", "testReadonly"."permissions" AS "testReadonly_permissions", "testReadonly"."roles" AS "testReadonly_roles", "testReadonly"."numbers" AS "testReadonly_numbers" FROM "public"."test_readonly_table"  AS "testReadonly"  WHERE "testReadonly"."permissions" @> ARRAY[$1,$2]::VARCHAR[]'
    );
    expect(params).toEqual(['read', 'write']);
  });

  it('should work with readonly number arrays', () => {
    const sqlString = db
      .from(TestTableWithReadonly)
      .where((_) => _.testReadonly.numbers.contains([1, 2, 3]))
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "testReadonly"."id" AS "testReadonly_id", "testReadonly"."tags" AS "testReadonly_tags", "testReadonly"."internalTags" AS "testReadonly_internalTags", "testReadonly"."permissions" AS "testReadonly_permissions", "testReadonly"."roles" AS "testReadonly_roles", "testReadonly"."numbers" AS "testReadonly_numbers" FROM "public"."test_readonly_table"  AS "testReadonly"  WHERE "testReadonly"."numbers" @> ARRAY[$1,$2,$3]::INT[]'
    );
    expect(params).toEqual([1, 2, 3]);
  });

  it('should work with complex expressions combining readonly arrays', () => {
    const sqlString = db
      .from(TestTableWithReadonly)
      .where((_) =>
        _.testReadonly.internalTags
          .contains(['arman'])
          .and(_.testReadonly.permissions.contains(['admin']))
          .and(_.testReadonly.numbers.contains([42]))
      )
      .getSqlString();

    const query = sqlString.getQuery();
    const params = sqlString.getParameters();
    expect(query).toBe(
      'SELECT "testReadonly"."id" AS "testReadonly_id", "testReadonly"."tags" AS "testReadonly_tags", "testReadonly"."internalTags" AS "testReadonly_internalTags", "testReadonly"."permissions" AS "testReadonly_permissions", "testReadonly"."roles" AS "testReadonly_roles", "testReadonly"."numbers" AS "testReadonly_numbers" FROM "public"."test_readonly_table"  AS "testReadonly"  WHERE (("testReadonly"."internalTags" @> ARRAY[$1]::VARCHAR[]) AND ("testReadonly"."permissions" @> ARRAY[$2]::VARCHAR[])) AND ("testReadonly"."numbers" @> ARRAY[$3]::INT[])'
    );
    expect(params).toEqual(['arman', 'admin', 42]);
  });
});
