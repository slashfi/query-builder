import type { GenericAny } from '@/core-utils';
import { getAstNodeRepository } from '../ast-node-repository';
import type { ClauseBase, ExpressionBase } from '../Base';
import { createAstNode } from '../createAstNode';

export interface ClauseFromExpression<Expr extends ExpressionBase<GenericAny>>
  extends ClauseBase<
    Expr extends ExpressionBase<infer DataType> ? DataType : never
  > {
  variant: 'clause_from_expression';
  type: 'clause_from_expression';
  expr: Expr;
  isAggregate: false;
}

export const clauseFromExpression = createAstNode<
  ClauseFromExpression<ExpressionBase<GenericAny>>
>()({
  class: 'clause',
  variant: 'clause_from_expression',
  type: 'clause_from_expression',
  create: <Expr extends ExpressionBase<GenericAny>>(expr: Expr) => {
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
