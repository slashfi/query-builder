import { assertUnreachable } from '@/core-utils';
import type { ClauseBase, DataTypeBase, ExpressionBase } from '../Base';
import {
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeNull,
  type DataTypeTimestamp,
  type DataTypeUnion,
  type DataTypeVarchar,
  createDataTypeVoid,
} from '../DataType';
import { getAstNodeRepository } from '../ast-node-repository';
import { createAstNode } from '../createAstNode';
import { type SqlString, sql } from '../sql-string';

export type OrderByList = ReadonlyArray<OrderByListItem>;
export interface OrderByListItem {
  expression: ExpressionBase<
    | DataTypeInteger
    | DataTypeFloat
    | DataTypeVarchar
    | DataTypeTimestamp
    | DataTypeUnion<[DataTypeInteger, DataTypeNull]>
    | DataTypeUnion<[DataTypeFloat, DataTypeNull]>
    | DataTypeUnion<[DataTypeVarchar, DataTypeNull]>
    | DataTypeUnion<[DataTypeTimestamp, DataTypeNull]>
  >;
  direction: 'asc' | 'desc';
}

export interface ClauseForOrderByList<Items extends OrderByList = OrderByList>
  extends ClauseBase<DataTypeBase> {
  variant: 'order_by_clause';
  type: 'order_by_clause';
  items: Items;
}

export const clauseForOrderByList = createAstNode<
  ClauseForOrderByList<OrderByList>
>()({
  class: 'clause',
  type: 'order_by_clause',
  variant: 'order_by_clause',
  create: <T extends OrderByList>(listItems: T): ClauseForOrderByList<T> => ({
    class: 'clause',
    variant: 'order_by_clause',
    type: 'order_by_clause',
    items: listItems,
    dataType: createDataTypeVoid(),
  }),
  writeSql: (node) => {
    const orderByItems = node.items.map((item) => {
      const nodeSql = getAstNodeRepository(item.expression).writeSql(
        item.expression,
        node
      );

      const direction: SqlString = (() => {
        switch (item.direction) {
          case 'asc':
            return sql`ASC`;
          case 'desc':
            return sql`DESC`;
          default:
            throw assertUnreachable(item.direction);
        }
      })();

      return sql`${nodeSql} ${direction}`;
    });
    return sql`ORDER BY ${sql.join(orderByItems, ', ')}`;
  },
});
