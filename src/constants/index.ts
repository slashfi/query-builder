import { createExpressionBuilder } from '../expression-builder';
import { constantForInteger } from './ConstantForInteger';
import { constantForVarchar } from './ConstantForVarchar';

export * from './base';
export { constantForArray } from './ConstantForArray';
export { constantForBoolean } from './ConstantForBoolean';
export { constantForDecimal } from './ConstantForDecimal';
export { constantForFloat } from './ConstantForFloat';
export { constantForInteger } from './ConstantForInteger';
export { constantForJson } from './ConstantForJson';
export { constantForTimestamp } from './ConstantForTimestamp';
export { constantForVarchar } from './ConstantForVarchar';

export function constantInt<Value extends number>(value: Value) {
  return createExpressionBuilder(constantForInteger.create(value));
}

export const consts = {
  int: constantInt,
  varchar<Value extends string>(value: Value) {
    return createExpressionBuilder(constantForVarchar.create(value));
  },
};
