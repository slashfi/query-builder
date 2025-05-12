import { getAstNodeRepository } from '../ast-node-repository';
import type { ColumnReference, DataTypeBase, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import { sql } from '../sql-string';
import type { AggregateColumnReferences } from './aggregate-expression-base';

export interface ExpressionBracket<Expr extends ExpressionBase<DataTypeBase>>
  extends ExpressionBase<Expr['dataType']> {
  type: 'bracket';
  variant: 'bracket_expression';
  expr: Expr;
  columnReferences: Expr['columnReferences'] extends infer U extends
    ReadonlyArray<ColumnReference>
    ? AggregateColumnReferences<U>
    : [];
}

export const expressionBracket = createAstNode<
  ExpressionBracket<ExpressionBase<any>>
>()({
  class: 'expression',
  variant: 'bracket_expression',
  type: 'bracket',
  create: <Expr extends ExpressionBase<DataTypeBase>>(expr: Expr) => {
    return {
      class: 'expression',
      variant: 'bracket_expression',
      type: 'bracket',
      columnReferences: [...expr.columnReferences].map(([column]) => [
        column,
        true,
      ]),
      dataType: expr.dataType,
      expr: expr,
      isAggregate: false,
    };
  },
  writeSql: (node) => {
    const nodeSql = getAstNodeRepository(node.expr).writeSql(node.expr, node);
    return sql`(${nodeSql})`;
  },
});
