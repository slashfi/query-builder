import type { TypecheckError } from '@/core-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { ThenableTestTable, db } from './thenable-result.schema';

describe('ThenableResult type combinations', () => {
  describe('Non-strict index (by_name, columnsOnly: false)', () => {
    it('returns array by default', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_name)
        .where({ name: 'test' });

      expectTypeOf(res).toMatchTypeOf<{ name: string }[]>();
    });

    it('returns tuple for unique result', async () => {
      try {
        const res = await db
          .selectFromIndex(ThenableTestTable.idx.by_name)
          .where({ name: 'test' })
          .expectOne();

        expectTypeOf(res).toEqualTypeOf<[{ name: string; id: string }]>();
      } catch {}
    });

    it('supports custom select with nested fields', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_name)
        .where({ name: 'test' })
        .select({
          name: (_) => _.thenableTest.name,
          upperName: (_) => _.thenableTest.name,
          nested: {
            status: (_) => _.thenableTest.status,
            meta: {
              created: (_) =>
                _.thenableTest.metadata.accessStringPath((_) => _.createdAt),
            },
          },
        });

      expectTypeOf(res).toMatchTypeOf<
        {
          name: string;
          upperName: string;
          nested: {
            status: 'active' | 'inactive';
            meta: {
              created: string | undefined;
            };
          };
        }[]
      >();
    });
  });

  describe('Strict index (by_status_strict, columnsOnly: true)', () => {
    it('returns exact columns in array', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_status_strict)
        .where({ status: 'active' });

      expectTypeOf(res).toEqualTypeOf<
        {
          id: string;
          status: 'active' | 'inactive';
        }[]
      >();
    });

    it('returns exact columns in tuple for unique result', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_status_strict)
        .where({ status: 'active' })
        .limit(1);

      expectTypeOf(res).toEqualTypeOf<
        [
          | {
              id: string;
              status: 'active' | 'inactive';
            }
          | undefined,
        ]
      >();
    });

    it('does not allow custom select', () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_status_strict)
        .where({ status: 'active' });

      expectTypeOf(query.select).toMatchTypeOf<
        TypecheckError<'Cannot use select on a strict index', {}>
      >();
    });
  });

  describe('Unique index (by_id, columnsOnly: false)', () => {
    it('returns single result in tuple', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_id)
        .where({ id: '123' });

      expectTypeOf(res).toMatchTypeOf<{ id: string }[]>();
    });

    it('supports custom select with single result in tuple', async () => {
      try {
        const res = await db
          .selectFromIndex(ThenableTestTable.idx.by_id)
          .where({ id: '123' })
          .expectOne()
          .select({
            id: (_) => _.thenableTest.id,
            meta: {
              created: (_) =>
                _.thenableTest.metadata.accessStringPath((_) => _.createdAt),
              updated: (_) =>
                _.thenableTest.metadata.accessStringPath((_) => _.updatedAt),
            },
          });

        expectTypeOf(res).toEqualTypeOf<
          [
            {
              id: string;
              meta: {
                created: string | undefined;
                updated: string | undefined;
              };
            },
          ]
        >();
      } catch {}
    });
  });

  describe('Composite strict index (by_name_status_strict, columnsOnly: true)', () => {
    it('returns exact columns in array', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_name_status_strict)
        .where({
          name: 'test',
          status: 'active',
        });

      expectTypeOf(res).toMatchTypeOf<
        {
          name: string;
          status: 'active' | 'inactive';
        }[]
      >();
    });

    it('does not allow custom select', () => {
      const query = db
        .selectFromIndex(ThenableTestTable.idx.by_name_status_strict)
        .where({
          name: 'test',
          status: 'active',
        });

      expectTypeOf(query.select).toMatchTypeOf<
        TypecheckError<'Cannot use select on a strict index', {}>
      >();
    });
  });

  describe('Composite non-strict index (by_count_name, columnsOnly: false)', () => {
    it('returns all columns by default', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_count_name)
        .where({
          count: 10,
          name: 'test',
        });

      expectTypeOf(res).toMatchTypeOf<
        {
          count: number;
          name: string;
          tags: string[] | undefined;
        }[]
      >();
    });

    it('supports custom select with stored columns', async () => {
      const res = await db
        .selectFromIndex(ThenableTestTable.idx.by_count_name)
        .where({
          count: 10,
          name: 'test',
        })
        .select({
          count: (_) => _.thenableTest.count,
          tagCount: (_) => _.thenableTest.tags,
        });

      expectTypeOf(res).toMatchTypeOf<
        {
          count: number;
          tagCount: string[] | undefined;
        }[]
      >();
    });
  });
});
