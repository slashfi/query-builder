import type { GenericAny } from '../core-utils';
import { getAstNodeRepository } from '../ast-node-repository';
import type { DataTypeBase, ExpressionBase } from '../Base';
import {
  clauseForOrderByList,
  type OrderByList,
} from '../clauses/ClauseForOrderBy';
import { createAstNode } from '../createAstNode';
import { createDataTypeInteger, type DataTypeInteger } from '../DataType';
import { sql } from '../sql-string';

export interface ExpressionRowNumber<
  PartitionByExpr extends ExpressionBase<DataTypeBase>,
  OrderBy extends OrderByList,
> extends ExpressionBase<DataTypeInteger<number>> {
  type: 'row_number';
  variant: 'scalar_function_expression';
  orderByList?: OrderBy;
  partitionByExpr?: PartitionByExpr;
  columnReferences: readonly [
    ...PartitionByExpr['columnReferences'],
    ...Flatten<{
      [Key in keyof OrderBy]: OrderBy[Key] extends infer U extends
        ExpressionBase<GenericAny>
        ? U['columnReferences']
        : never;
    }>,
  ];
  inferredAliases: ['row_number'];
}

type Flatten<T extends readonly GenericAny[]> = T extends readonly [
  infer First,
  ...infer Rest extends readonly GenericAny[],
]
  ? First extends ExpressionBase<GenericAny>
    ? [...First['columnReferences'], ...Flatten<Rest>]
    : Flatten<Rest>
  : [];

export const expressionRowNumber = createAstNode<
  ExpressionRowNumber<ExpressionBase<DataTypeBase>, OrderByList>
>()({
  class: 'expression',
  variant: 'scalar_function_expression',
  type: 'row_number',
  create: (options: {
    partitionByExpr?: ExpressionBase<DataTypeBase>;
    orderByList?: OrderByList;
  }) => {
    return {
      class: 'expression',
      variant: 'scalar_function_expression',
      type: 'row_number',
      columnReferences: [
        ...(options.orderByList?.flatMap(
          (val) => val.expression.columnReferences
        ) ?? []),
        ...(options.partitionByExpr?.columnReferences ?? []),
      ] as GenericAny[],
      dataType: createDataTypeInteger(),
      isAggregate: false,
      ...(options.orderByList && { orderByList: options.orderByList }),
      ...(options.partitionByExpr && {
        partitionByExpr: options.partitionByExpr,
      }),
      inferredAliases: ['row_number'],
    };
  },
  writeSql: (data, parent) => {
    const partitionBy = data.partitionByExpr
      ? sql`PARTITION BY ${getAstNodeRepository(data.partitionByExpr).writeSql(
          data.partitionByExpr,
          parent
        )}`
      : sql``;
    const orderBy = data.orderByList
      ? getAstNodeRepository(clauseForOrderByList).writeSql(
          data.orderByList,
          parent
        )
      : sql``;
    return sql`ROW_NUMBER() OVER (${partitionBy} ${orderBy})`;
  },
});
