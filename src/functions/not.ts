import type { ExpressionBase } from '../Base';
import type { DataTypeBoolean } from '../DataType';
import type { ExpressionBuilderShape } from '../ExpressionBuilder';
import { createExpressionBuilder } from '../expression-builder';
import { expressionBracket } from '../expressions/ExpressionBracket';
import { expressionRightUnaryBinary } from '../expressions/ExpressionRightUnaryBinary';
import { operatorUnaryIs } from '../operators/OperatorUnaryIs';

export const not = (
  clause: ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
) => {
  return createExpressionBuilder(
    expressionRightUnaryBinary.create({
      leftExpr: expressionBracket.create(clause._expression),
      rightUnaryOp: operatorUnaryIs.create('FALSE'),
    })
  );
};
