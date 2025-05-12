import { getAstNodeRepository } from '../ast-node-repository';
import type { ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import { type DataTypeBoolean, createDataTypeBoolean } from '../data-type';
import type { OperatorUnaryBase } from '../operators/base';
import { sql } from '../sql-string';

export interface ExpressionRightUnaryBinary<
  LeftExpr extends ExpressionBase<any>,
  UnaryOp extends OperatorUnaryBase,
> extends ExpressionBase<DataTypeBoolean<boolean>> {
  variant: 'binary_expression';
  type: 'right_unary_binary';
  leftExpr: LeftExpr;
  rightUnaryOperator: UnaryOp;
  isAggregate: false;
  columnReferences: LeftExpr['columnReferences'];
  inferredAliases: [];
}

export const expressionRightUnaryBinary = createAstNode<
  ExpressionRightUnaryBinary<ExpressionBase<any>, OperatorUnaryBase>
>()({
  class: 'expression',
  variant: 'binary_expression',
  type: 'right_unary_binary',
  create: <
    LeftExpr extends ExpressionBase<any>,
    RightUnaryOp extends OperatorUnaryBase,
  >(options: {
    leftExpr: LeftExpr;
    rightUnaryOp: RightUnaryOp;
  }): ExpressionRightUnaryBinary<LeftExpr, RightUnaryOp> => {
    return {
      class: 'expression',
      variant: 'binary_expression',
      type: 'right_unary_binary',
      columnReferences: [...options.leftExpr.columnReferences],
      dataType: createDataTypeBoolean({ isNullable: false }),
      isAggregate: false,
      leftExpr: options.leftExpr,
      rightUnaryOperator: options.rightUnaryOp,
      inferredAliases: [],
    };
  },
  writeSql: (node) => {
    const leftExpr = getAstNodeRepository(node.leftExpr).writeSql(
      node.leftExpr,
      node
    );
    const rightUnaryOp = getAstNodeRepository(node.rightUnaryOperator).writeSql(
      node.rightUnaryOperator,
      node
    );

    return sql`${leftExpr} ${rightUnaryOp}`;
  },
});
