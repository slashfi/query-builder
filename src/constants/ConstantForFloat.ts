import type { GenericAny } from '../core-utils';
import { createAstNode } from '../createAstNode';
import { createDataTypeFloat, type DataTypeFloat } from '../DataType';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForFloat<Value extends number = number>
  extends ConstantBase<DataTypeFloat<Value>> {
  type: 'float';
  value: Value;
  inferredAliases: [];
}

export const constantForFloat = createAstNode<ConstantForFloat<GenericAny>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'float',
  create: <T extends number = number>(value: T): ConstantForFloat<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as GenericAny,
      dataType: createDataTypeFloat({ isNullable: false }),
      inferredAliases: [],
      isAggregate: false,
      type: 'float',
      value,
    };
  },
  writeSql: (node) => {
    return sql.p(node.value);
  },
});
