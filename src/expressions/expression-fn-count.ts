import { getAstNodeRepository } from '../ast-node-repository';
import type { ColumnReference, DataTypeBase, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import { type DataTypeInteger, createDataTypeInteger } from '../data-type';
import { sql } from '../sql-string';
import type {
  AggregateColumnReferences,
  AggregateExpressionBase,
} from './aggregate-expression-base';

export interface ExpressionAggregateCount<
  Expr extends ExpressionBase<DataTypeBase>,
> extends AggregateExpressionBase<DataTypeInteger<number>> {
  type: 'count';
  expr: Expr;
  columnReferences: Expr['columnReferences'] extends infer U extends
    ReadonlyArray<ColumnReference>
    ? AggregateColumnReferences<U>
    : [];
  inferredAliases: ['count'];
}

export const expressionCount = createAstNode<
  ExpressionAggregateCount<ExpressionBase<any>>
>()({
  class: 'expression',
  variant: 'aggregate_expression',
  type: 'count',
  create: <Expr extends ExpressionBase<DataTypeBase>>(expr: Expr) => {
    return {
      class: 'expression',
      variant: 'aggregate_expression',
      type: 'count',
      columnReferences: [...expr.columnReferences].map(([column]) => [
        column,
        true,
      ]),
      dataType: createDataTypeInteger({
        isNullable: false,
      }),
      expr: expr,
      inferredAliases: ['count'],
      isAggregate: true,
    };
  },
  writeSql: (node) => {
    const nodeSql = getAstNodeRepository(node.expr).writeSql(node.expr, node);
    return sql`COUNT(${nodeSql})`;
  },
});
