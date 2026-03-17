import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';

interface JsonbContainsTestSchema {
  id: number;
  userProfile: {
    name: string;
    email: string;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
      tags: string[];
    };
    metadata?: {
      lastLogin?: Date;
      loginCount?: number;
    };
  };
  permissions: {
    read: boolean;
    write: boolean;
    admin?: boolean;
    roles: ('user' | 'admin' | 'super_admin')[];
  };
}

const testSym = createDbDiscriminator('test');
const db = createDb({
  runQueriesInTransaction: async () => {},
  query: async () => [],
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

class JsonbContainsTest {
  static readonly Table = db
    .buildTableFromSchema<JsonbContainsTestSchema>()
    .columns({
      id: (_) => _.int(),
      userProfile: (_) => _.json(),
      permissions: (_) => _.json(),
    })
    .primaryKey('id')
    .tableName('jsonb_contains_test')
    .defaultAlias('jsonbTest')
    .build();
}

describe('JSONB contains operator', () => {
  it('should generate correct SQL for basic JSONB contains operation', () => {
    const sqlString = db
      .from(JsonbContainsTest)
      .where((_) => _.jsonbTest.userProfile.contains({ name: 'John' }))
      .getSqlString();

    expect(sqlString.getQuery()).toBe(
      'SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."userProfile" AS "jsonbTest_userProfile", "jsonbTest"."permissions" AS "jsonbTest_permissions" FROM "public"."jsonb_contains_test"  AS "jsonbTest"  WHERE "jsonbTest"."userProfile" @> CAST($1 AS JSON)'
    );
    expect(sqlString.getParameters()).toEqual([
      JSON.stringify({ name: 'John' }),
    ]);
  });

  it('should work with nested object partial matching', () => {
    const sqlString = db
      .from(JsonbContainsTest)
      .where((_) =>
        _.jsonbTest.userProfile.contains({
          preferences: { theme: 'dark' },
        })
      )
      .getSqlString();

    expect(sqlString.getQuery()).toBe(
      'SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."userProfile" AS "jsonbTest_userProfile", "jsonbTest"."permissions" AS "jsonbTest_permissions" FROM "public"."jsonb_contains_test"  AS "jsonbTest"  WHERE "jsonbTest"."userProfile" @> CAST($1 AS JSON)'
    );
    expect(sqlString.getParameters()).toEqual([
      JSON.stringify({ preferences: { theme: 'dark' } }),
    ]);
  });

  it('should work with array contains in JSONB', () => {
    const sqlString = db
      .from(JsonbContainsTest)
      .where((_) =>
        _.jsonbTest.permissions.contains({
          roles: ['admin'],
        })
      )
      .getSqlString();

    expect(sqlString.getQuery()).toBe(
      'SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."userProfile" AS "jsonbTest_userProfile", "jsonbTest"."permissions" AS "jsonbTest_permissions" FROM "public"."jsonb_contains_test"  AS "jsonbTest"  WHERE "jsonbTest"."permissions" @> CAST($1 AS JSON)'
    );
    expect(sqlString.getParameters()).toEqual([
      JSON.stringify({ roles: ['admin'] }),
    ]);
  });

  it('should work with multiple conditions', () => {
    const sqlString = db
      .from(JsonbContainsTest)
      .where((_) =>
        _.jsonbTest.userProfile
          .contains({ name: 'John' })
          .and(_.jsonbTest.permissions.contains({ read: true }))
      )
      .getSqlString();

    expect(sqlString.getQuery()).toBe(
      'SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."userProfile" AS "jsonbTest_userProfile", "jsonbTest"."permissions" AS "jsonbTest_permissions" FROM "public"."jsonb_contains_test"  AS "jsonbTest"  WHERE ("jsonbTest"."userProfile" @> CAST($1 AS JSON)) AND ("jsonbTest"."permissions" @> CAST($2 AS JSON))'
    );
    expect(sqlString.getParameters()).toEqual([
      JSON.stringify({ name: 'John' }),
      JSON.stringify({ read: true }),
    ]);
  });

  it('should work with optional fields using RecursivePartial', () => {
    const sqlString = db
      .from(JsonbContainsTest)
      .where((_) =>
        _.jsonbTest.userProfile.contains({
          metadata: { loginCount: 5 },
        })
      )
      .getSqlString();

    expect(sqlString.getQuery()).toBe(
      'SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."userProfile" AS "jsonbTest_userProfile", "jsonbTest"."permissions" AS "jsonbTest_permissions" FROM "public"."jsonb_contains_test"  AS "jsonbTest"  WHERE "jsonbTest"."userProfile" @> CAST($1 AS JSON)'
    );
    expect(sqlString.getParameters()).toEqual([
      JSON.stringify({ metadata: { loginCount: 5 } }),
    ]);
  });

  it('should work with complex nested partial matching', () => {
    const sqlString = db
      .from(JsonbContainsTest)
      .where((_) =>
        _.jsonbTest.userProfile.contains({
          preferences: {
            notifications: true,
            tags: ['important'],
          },
        })
      )
      .getSqlString();

    expect(sqlString.getQuery()).toBe(
      'SELECT "jsonbTest"."id" AS "jsonbTest_id", "jsonbTest"."userProfile" AS "jsonbTest_userProfile", "jsonbTest"."permissions" AS "jsonbTest_permissions" FROM "public"."jsonb_contains_test"  AS "jsonbTest"  WHERE "jsonbTest"."userProfile" @> CAST($1 AS JSON)'
    );
    expect(sqlString.getParameters()).toEqual([
      JSON.stringify({
        preferences: {
          notifications: true,
          tags: ['important'],
        },
      }),
    ]);
  });
});
