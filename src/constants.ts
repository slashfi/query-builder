import { constantForInteger } from './constants/constant-for-integer';
import { constantForVarchar } from './constants/constant-for-varchar';
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
