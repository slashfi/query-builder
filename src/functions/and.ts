import type { BaseDbDiscriminator, ExpressionBase } from '../Base';
import type { DataTypeBoolean } from '../DataType';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
} from '../ExpressionBuilder';
import { createExpressionBuilder } from '../expression-builder';
import { expressionLeftRightBinary } from '../expressions/ExpressionLeftRightBinary';
import { operatorBinaryLogical } from '../operators/OperatorBinaryLogical';

export const and: AndValue = (...[first, ...rest]) => {
  return createExpressionBuilder(
    rest.reduce<ExpressionBase<DataTypeBoolean>>((acc, clause) => {
      if (!clause) {
        return acc;
      }
      return expressionLeftRightBinary.create({
        leftExpr: acc,
        operator: operatorBinaryLogical.create('AND'),
        rightExpr: clause._expression,
      });
    }, first._expression)
  );
};
type AndValue = <S extends BaseDbDiscriminator>(
  ...clauses: [
    ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>,
    ...(ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>> | undefined)[],
  ]
) => ExpressionBuilder<ExpressionBase<DataTypeBoolean>, S>;
