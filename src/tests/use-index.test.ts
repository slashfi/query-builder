import type { GenericAny } from '@/core-utils';
import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';
import type { SqlString } from '../sql-string';

const mockQueryExecutor = {
  query: async (_queryName: string, _sqlString: SqlString) => {
    return [];
  },
  runQueriesInTransaction: async (
    runQueries: (manager: GenericAny) => Promise<void>
  ) => {
    await runQueries(console);
  },
};

const db = createDb({
  query: mockQueryExecutor.query,
  runQueriesInTransaction: mockQueryExecutor.runQueriesInTransaction,
  discriminator: createDbDiscriminator('test'),
  getQueryBuilderIndexes: () => Promise.resolve({} as GenericAny),
});

interface OrderSchema {
  id: string;
  userId: string;
  status: string;
  amount: number;
  createdAt: Date;
}

interface UserSchema {
  id: string;
  email: string;
  name: string;
}

const OrderTable = {
  Table: db
    .buildTableFromSchema<OrderSchema>()
    .tableName('orders')
    .defaultAlias('order')
    .columns({
      id: (_) => _.varchar(),
      userId: (_) => _.varchar(),
      status: (_) => _.varchar(),
      amount: (_) => _.int(),
      createdAt: (_) => _.timestamp(),
    })
    .primaryKey('id')
    .indexes(({ table, index }) => ({
      byUserIdCreatedAt: index(table.userId, table.createdAt).storing(
        table.status,
        table.amount
      ),
      byStatus: index(table.status),
    }))
    .build(),
} as const;

const UserTable = {
  Table: db
    .buildTableFromSchema<UserSchema>()
    .tableName('users')
    .defaultAlias('user')
    .columns({
      id: (_) => _.varchar(),
      email: (_) => _.varchar(),
      name: (_) => _.varchar(),
    })
    .primaryKey('id')
    .indexes(({ table, index }) => ({
      byEmail: index(table.email).unique(),
    }))
    .build(),
} as const;

const OrderIdx = db.indexConfig(OrderTable, {
  byUserIdCreatedAt: {
    strict: { columnsOnly: false },
  },
  byStatus: {
    strict: { columnsOnly: false },
  },
});

const UserIdx = db.indexConfig(UserTable, {
  byEmail: {
    strict: { columnsOnly: false },
  },
});

db.register(OrderTable);
db.register(UserTable);

describe('from() with index config', () => {
  it('should generate index hint paired with the correct table', () => {
    const query = db
      .from(OrderIdx.byUserIdCreatedAt)
      .where((_) => _.order.userId.equals('user_123'));

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('"orders"@"orders_byUserIdCreatedAt"');
    expect(sqlText).toContain('AS "order"');
  });

  it('should generate correct index name for different indexes', () => {
    const query = db
      .from(OrderIdx.byStatus)
      .where((_) => _.order.status.equals('active'));

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('"orders"@"orders_byStatus"');
  });

  it('should not apply index hint to a joined table', () => {
    const query = db.from(OrderIdx.byUserIdCreatedAt).leftJoin(UserTable, {
      on: (_) => _.user.id.equals(_.order.userId),
    });

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('"orders"@"orders_byUserIdCreatedAt"');
    expect(sqlText).not.toContain('"users"@');
  });

  it('should work with WHERE, SELECT, ORDER BY, and LIMIT', () => {
    const query = db
      .from(OrderIdx.byUserIdCreatedAt)
      .where((_) => _.order.status.equals('settled'))
      .select((_) => [_.order.id, _.order.amount])
      .orderBy((_) => [_.order.createdAt])
      .limit(10);

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('"orders"@"orders_byUserIdCreatedAt"');
    expect(sqlText).toContain('WHERE');
    expect(sqlText).toContain('ORDER BY');
    expect(sqlText).toContain('LIMIT');
  });
});

describe('join with index config', () => {
  it('should apply index hint only to the joined table, not the base', () => {
    const query = db.from(OrderTable).leftJoin(UserIdx.byEmail, {
      on: (_) => _.user.id.equals(_.order.userId),
    });

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('"users"@"users_byEmail"');
    expect(sqlText).not.toContain('"orders"@');
  });

  it('should apply separate index hints to both base and joined tables', () => {
    const query = db
      .from(OrderIdx.byUserIdCreatedAt)
      .leftJoin(UserIdx.byEmail, {
        on: (_) => _.user.id.equals(_.order.userId),
      });

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('"orders"@"orders_byUserIdCreatedAt"');
    expect(sqlText).toContain('"users"@"users_byEmail"');
  });

  it('should work with join hints and index configs together', () => {
    const query = db
      .from(OrderIdx.byUserIdCreatedAt)
      .leftJoin(UserIdx.byEmail, {
        joinHint: 'LOOKUP',
        on: (_) => _.user.id.equals(_.order.userId),
      });

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('"orders"@"orders_byUserIdCreatedAt"');
    expect(sqlText).toContain('LEFT LOOKUP JOIN');
    expect(sqlText).toContain('"users"@"users_byEmail"');
  });

  it('should work with innerJoin index config', () => {
    const query = db.from(OrderTable).innerJoin(UserIdx.byEmail, {
      on: (_) => _.user.id.equals(_.order.userId),
    });

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('INNER JOIN');
    expect(sqlText).toContain('"users"@"users_byEmail"');
    expect(sqlText).not.toContain('"orders"@');
  });

  it('should work with rightJoin index config', () => {
    const query = db.from(OrderTable).rightJoin(UserIdx.byEmail, {
      on: (_) => _.user.id.equals(_.order.userId),
    });

    const sqlText = query.getSqlString().getQuery();

    expect(sqlText).toContain('RIGHT JOIN');
    expect(sqlText).toContain('"users"@"users_byEmail"');
    expect(sqlText).not.toContain('"orders"@');
  });
});
