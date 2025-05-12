import { getAstNodeRepository } from '../ast-node-repository';
import type { ClauseBase, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';

export interface ClauseFromExpression<Expr extends ExpressionBase<any>>
  extends ClauseBase<
    Expr extends ExpressionBase<infer DataType> ? DataType : never
  > {
  variant: 'clause_from_expression';
  type: 'clause_from_expression';
  expr: Expr;
  isAggregate: false;
}

export const clauseFromExpression = createAstNode<
  ClauseFromExpression<ExpressionBase<any>>
>()({
  class: 'clause',
  variant: 'clause_from_expression',
  type: 'clause_from_expression',
  create: <Expr extends ExpressionBase<any>>(expr: Expr) => {
    return {
      class: 'clause',
      variant: 'clause_from_expression',
      type: 'clause_from_expression',
      dataType: expr.dataType,
      expr: expr,
      isAggregate: false,
    };
  },
  writeSql: (node) => {
    return getAstNodeRepository(node.expr).writeSql(node.expr, node);
  },
});
