import { createAstNode } from '../create-ast-node';
import { type DataTypeFloat, createDataTypeFloat } from '../data-type';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForFloat<Value extends number = number>
  extends ConstantBase<DataTypeFloat<Value>> {
  type: 'float';
  value: Value;
  inferredAliases: [];
}

export const constantForFloat = createAstNode<ConstantForFloat<any>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'float',
  create: <T extends number = number>(value: T): ConstantForFloat<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as any,
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
