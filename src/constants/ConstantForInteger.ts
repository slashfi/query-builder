import type { GenericAny } from '../core-utils';
import { createAstNode } from '../createAstNode';
import { createDataTypeInteger, type DataTypeInteger } from '../DataType';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForInteger<Value extends number = number>
  extends ConstantBase<DataTypeInteger<Value>> {
  type: 'int';
  value: Value;
  inferredAliases: [];
}

export const constantForInteger = createAstNode<
  ConstantForInteger<GenericAny>
>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'int',
  create: <T extends number = number>(value: T): ConstantForInteger<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as GenericAny,
      dataType: createDataTypeInteger({ isNullable: false }),
      inferredAliases: [],
      isAggregate: false,
      type: 'int',
      value,
    };
  },
  writeSql: (node) => {
    return sql.p(node.value);
  },
});
