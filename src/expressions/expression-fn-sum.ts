import { getAstNodeRepository } from '../ast-node-repository';
import type { ColumnReference, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import {
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeNull,
  type DataTypeUnion,
  makeDataTypeNullable,
} from '../data-type';
import { sql } from '../sql-string';
import type {
  AggregateColumnReferences,
  AggregateExpressionBase,
} from './aggregate-expression-base';

export type ValidDataTypesForAggregateSum = DataTypeFloat | DataTypeInteger;

export interface ExpressionAggregateSum<
  Expr extends ExpressionBase<
    DataTypeUnion<[ValidDataTypesForAggregateSum, DataTypeNull]>
  >,
> extends AggregateExpressionBase<Expr['dataType']> {
  type: 'sum';
  expr: Expr;
  columnReferences: Expr['columnReferences'] extends infer U extends
    ReadonlyArray<ColumnReference>
    ? AggregateColumnReferences<U>
    : [];
  inferredAliases: ['sum'];
}

export const expressionSum = createAstNode<
  ExpressionAggregateSum<ExpressionBase<any>>
>()({
  class: 'expression',
  variant: 'aggregate_expression',
  type: 'sum',
  create: <Expr extends ExpressionBase<ValidDataTypesForAggregateSum>>(
    expr: Expr
  ) => {
    return {
      class: 'expression',
      variant: 'aggregate_expression',
      type: 'sum',
      columnReferences: [...expr.columnReferences].map(([column]) => [
        column,
        true,
      ]),
      dataType: makeDataTypeNullable(expr.dataType),
      expr: expr,
      inferredAliases: ['sum'],
      isAggregate: true,
    };
  },
  writeSql: (node) => {
    const nodeSql = getAstNodeRepository(node.expr).writeSql(node.expr, node);
    return sql`SUM(${nodeSql})`;
  },
});
