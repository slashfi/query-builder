import {
  transformIndexQueryBuilderResult,
  writeSelectFromIndexQuery,
} from '@slashfi/query-builder/index-query-builder';
import { describe, expect, it } from 'vitest';
import { ThenableTestTable, db } from './thenable-result.schema';

describe('writeSelectFromIndexQuery', () => {
  describe('Regular non-strict index (by_name)', () => {
    it('generates SELECT with WHERE conditions', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_name)
        .where({ name: 'test' });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."id" AS "id", "thenableTest"."name" AS "name" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest" WHERE "thenableTest"."name" = $1'
      );
      expect(sql.sqlString.getParameters()).toEqual(['test']);
    });

    it('generates SELECT with custom columns', async () => {
      const query = db.selectFromIndex(ThenableTestTable.idx.by_name).select({
        user_name: (_) => _.thenableTest.name,
        user_status: (_) => _.thenableTest.status,
      });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."name" AS "user_name", "thenableTest"."status" AS "user_status" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest"'
      );
    });
  });

  describe('Strict index (by_status_strict)', () => {
    it('generates SELECT with exact columns', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_status_strict)
        .where({ status: 'active' });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_status_strict,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."id" AS "id", "thenableTest"."status" AS "status" FROM "public"."thenable_test"@"thenable_test_by_status_strict" AS "thenableTest" WHERE "thenableTest"."status" = $1'
      );
      expect(sql.sqlString.getParameters()).toEqual(['active']);
    });
  });

  describe('Composite index with storing (by_count_name)', () => {
    it('generates SELECT with stored columns', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_count_name)
        .where({
          count: 10,
          name: 'test',
        });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_count_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."id" AS "id", "thenableTest"."count" AS "count", "thenableTest"."name" AS "name", "thenableTest"."tags" AS "tags" FROM "public"."thenable_test"@"thenable_test_by_count_name" AS "thenableTest" WHERE "thenableTest"."count" = $1 AND "thenableTest"."name" = $2'
      );
      expect(sql.sqlString.getParameters()).toEqual([10, 'test']);
    });

    it('generates SELECT with custom columns using stored fields', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_count_name)
        .where({
          count: 10,
          name: 'test',
        })
        .select({
          item_count: (_) => _.thenableTest.count,
          tag_list: (_) => _.thenableTest.tags,
        });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_count_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."count" AS "item_count", "thenableTest"."tags" AS "tag_list" FROM "public"."thenable_test"@"thenable_test_by_count_name" AS "thenableTest" WHERE "thenableTest"."count" = $1 AND "thenableTest"."name" = $2'
      );
      expect(sql.sqlString.getParameters()).toEqual([10, 'test']);
    });
  });

  describe('Complex queries', () => {
    it('generates SELECT with JSON field access', async () => {
      const query = db.selectFromIndex(ThenableTestTable.idx.by_name).select({
        name: (_) => _.thenableTest.name,
        created: (_) =>
          _.thenableTest.metadata.accessStringPath((_) => _.createdAt),
        updated: (_) =>
          _.thenableTest.metadata.accessStringPath((_) => _.updatedAt),
      });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."name" AS "name", "thenableTest"."metadata"->>$1 AS "created", "thenableTest"."metadata"->>$2 AS "updated" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest"'
      );
    });

    it('generates SELECT with array field', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_count_name)
        .select({
          name: (_) => _.thenableTest.name,
          tag_count: (_) => _.thenableTest.tags,
        });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_count_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."name" AS "name", "thenableTest"."tags" AS "tag_count" FROM "public"."thenable_test"@"thenable_test_by_count_name" AS "thenableTest"'
      );
    });

    it('generates SELECT with multiple conditions', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_name)
        .where({ name: 'test' })
        .andWhere((_) =>
          _.thenableTest.status
            .equals('active')
            .and(_.thenableTest.count.moreThan(5))
        );

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."id" AS "id", "thenableTest"."name" AS "name" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest" WHERE "thenableTest"."name" = $1 AND (("thenableTest"."status" = $2) AND ("thenableTest"."count" > $3))'
      );
      expect(sql.sqlString.getParameters()).toEqual(['test', 'active', 5]);
    });

    it('generates SELECT with nested select format', async () => {
      const query = db.selectFromIndex(ThenableTestTable.idx.by_name).select({
        basic: {
          name: (_) => _.thenableTest.name,
          status: (_) => _.thenableTest.status,
        },
        meta: {
          created: (_) =>
            _.thenableTest.metadata.accessStringPath((_) => _.createdAt),
          tags: (_) => _.thenableTest.tags,
        },
      });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."name" AS "basic.name", "thenableTest"."status" AS "basic.status", "thenableTest"."metadata"->>$1 AS "meta.created", "thenableTest"."tags" AS "meta.tags" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest"'
      );
    });
  });

  describe('Partial and unique indexes', () => {
    it('generates SELECT with partial index conditions', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_name)
        .where({ name: 'test' })
        .andWhere((_) => _.thenableTest.status.equals('active'))
        .expectOne();

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."id" AS "id", "thenableTest"."name" AS "name" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest" WHERE "thenableTest"."name" = $1 AND ("thenableTest"."status" = $2)'
      );
      expect(sql.sqlString.getParameters()).toEqual(['test', 'active']);
    });

    it('generates SELECT with storing columns and conditions', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_count_name)
        .where({
          count: 10,
          name: 'test',
        })
        .andWhere((_) => _.thenableTest.tags.isNotNull())
        .select({
          name: (_) => _.thenableTest.name,
          tag_list: (_) => _.thenableTest.tags,
        });

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_count_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."name" AS "name", "thenableTest"."tags" AS "tag_list" FROM "public"."thenable_test"@"thenable_test_by_count_name" AS "thenableTest" WHERE "thenableTest"."count" = $1 AND "thenableTest"."name" = $2 AND ("thenableTest"."tags" IS NOT NULL)'
      );
      expect(sql.sqlString.getParameters()).toEqual([10, 'test']);
    });
  });

  describe('Query options', () => {
    it('generates SELECT with LIMIT', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_name)
        .where({ name: 'test' })
        .limit(5);

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."id" AS "id", "thenableTest"."name" AS "name" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest" WHERE "thenableTest"."name" = $1  LIMIT 5'
      );
      expect(sql.sqlString.getParameters()).toEqual(['test']);
    });

    it('generates SELECT with additional conditions', async () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_name)
        .where({ name: 'test' })
        .andWhere((_) => _.thenableTest.status.equals('active'));

      const sql = await writeSelectFromIndexQuery(
        ThenableTestTable.idx.by_name,
        query._params
      );
      expect(sql.sqlString.getQuery().trim()).toBe(
        'SELECT "thenableTest"."id" AS "id", "thenableTest"."name" AS "name" FROM "public"."thenable_test"@"thenable_test_by_name" AS "thenableTest" WHERE "thenableTest"."name" = $1 AND ("thenableTest"."status" = $2)'
      );
      expect(sql.sqlString.getParameters()).toEqual(['test', 'active']);
    });
  });
});

describe('transformResult', () => {
  it('transforms basic fields without nesting', () => {
    const row = {
      name: 'test',
      status: 'active',
      count: 10,
    };

    const result = transformIndexQueryBuilderResult(row, []);
    expect(result).toEqual({
      name: 'test',
      status: 'active',
      count: 10,
    });
  });

  it('transforms nested object fields', () => {
    const row = {
      'basic.name': 'test',
      'basic.status': 'active',
    };

    const result = transformIndexQueryBuilderResult(row, []);
    expect(result).toEqual({
      basic: {
        name: 'test',
        status: 'active',
      },
    });
  });

  it('transforms multiple nested fields in same object', () => {
    const row = {
      'user.profile.firstName': 'John',
      'user.profile.lastName': 'Doe',
      'user.email': 'john@example.com',
    };

    const result = transformIndexQueryBuilderResult(row, []);
    expect(result).toEqual({
      user: {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
        },
        email: 'john@example.com',
      },
    });
  });

  it('transforms multiple different nested objects', () => {
    const row = {
      'basic.name': 'test',
      'basic.status': 'active',
      'meta.created': '2023-01-01',
      'meta.tags': ['tag1', 'tag2'],
    };

    const result = transformIndexQueryBuilderResult(row, []);
    expect(result).toEqual({
      basic: {
        name: 'test',
        status: 'active',
      },
      meta: {
        created: '2023-01-01',
        tags: ['tag1', 'tag2'],
      },
    });
  });
});
