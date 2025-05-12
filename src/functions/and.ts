import type { BaseDbDiscriminator, ExpressionBase } from '../base';
import type { DataTypeBoolean } from '../data-type';
import { createExpressionBuilder } from '../expression-builder';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
} from '../expression-builder-type';
import { expressionLeftRightBinary } from '../expressions/expression-left-right-binary';
import { operatorBinaryLogical } from '../operators/operator-binary-logical';

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
