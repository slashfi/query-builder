import type { ExpressionBuilderShape } from '../expression-builder-type';
import {
  type ExpressionNull,
  expressionNull,
} from '../expressions/expression-null';

export const nullValue: NullValue = () => {
  return {
    $type: Symbol('null'),
    _expression: expressionNull.create(),
  };
};
type NullValue = () => ExpressionBuilderShape<ExpressionNull>;
