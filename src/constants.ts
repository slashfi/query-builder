import { constantForInteger } from './constants/ConstantForInteger';
import { constantForVarchar } from './constants/ConstantForVarchar';
import { createExpressionBuilder } from './expression-builder';

export function constantInt<Value extends number>(value: Value) {
  return createExpressionBuilder(constantForInteger.create(value));
}

export const consts = {
  int: constantInt,
  varchar<Value extends string>(value: Value) {
    return createExpressionBuilder(constantForVarchar.create(value));
  },
};
