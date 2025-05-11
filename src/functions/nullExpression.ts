import type { ExpressionBuilderShape } from '../ExpressionBuilder';
import {
  type ExpressionNull,
  expressionNull,
} from '../expressions/ExpressionNull';

export const nullValue: NullValue = () => {
  return {
    $type: Symbol('null'),
    _expression: expressionNull.create(),
  };
};
type NullValue = () => ExpressionBuilderShape<ExpressionNull>;
