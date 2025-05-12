import { getAstNodeRepository } from '../ast-node-repository';
import type { ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import { type DataTypeBoolean, createDataTypeBoolean } from '../data-type';
import type { OperatorBinaryBase } from '../operators/base';
import { sql } from '../sql-string';

export interface ExpressionLeftRightBinary<
  LeftExpr extends ExpressionBase<any>,
  Operator extends OperatorBinaryBase,
  RightExpr extends ExpressionBase<any>,
> extends ExpressionBase<DataTypeBoolean> {
  variant: 'binary_expression';
  type: 'left_right_comparator';
  leftExpr: LeftExpr;
  operator: Operator;
  rightExpr: RightExpr;
  isAggregate: false;
  columnReferences: readonly [
    ...LeftExpr['columnReferences'],
    ...RightExpr['columnReferences'],
  ];
  inferredAliases: [];
}

export const expressionLeftRightBinary = createAstNode<
  ExpressionLeftRightBinary<
    ExpressionBase<any>,
    OperatorBinaryBase,
    ExpressionBase<any>
  >
>()({
  class: 'expression',
  variant: 'binary_expression',
  type: 'left_right_comparator',
  create: <
    LeftExpr extends ExpressionBase<any>,
    Operator extends OperatorBinaryBase,
    RightExpr extends ExpressionBase<any>,
  >(options: {
    leftExpr: LeftExpr;
    operator: Operator;
    rightExpr: RightExpr;
  }) => {
    return {
      class: 'expression',
      variant: 'binary_expression',
      type: 'left_right_comparator',
      columnReferences: [
        ...options.leftExpr.columnReferences,
        ...options.rightExpr.columnReferences,
      ],
      dataType: createDataTypeBoolean({ isNullable: false }),
      isAggregate: false,
      leftExpr: options.leftExpr,
      operator: options.operator,
      rightExpr: options.rightExpr,
      inferredAliases: [],
    };
  },
  writeSql: (node) => {
    const leftHandExpr = getAstNodeRepository(node.leftExpr).writeSql(
      node.leftExpr,
      node
    );

    const rightHandExpr = getAstNodeRepository(node.rightExpr).writeSql(
      node.rightExpr,
      node
    );

    const op = getAstNodeRepository(node.operator).writeSql(
      node.operator,
      node
    );

    return sql`${leftHandExpr} ${op} ${rightHandExpr}`;
  },
});
