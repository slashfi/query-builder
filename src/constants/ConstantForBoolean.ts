import { type DataTypeBoolean, createDataTypeBoolean } from '../DataType';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForBoolean<Value extends boolean = boolean>
  extends ConstantBase<DataTypeBoolean<Value>> {
  type: 'boolean';
  value: Value;
  inferredAliases: [];
}

export const constantForBoolean = createAstNode<ConstantForBoolean<any>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'boolean',
  create: <T extends boolean = boolean>(value: T): ConstantForBoolean<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as any,
      dataType: createDataTypeBoolean({ isNullable: false }),
      inferredAliases: [],
      isAggregate: false,
      type: 'boolean',
      value,
    };
  },
  writeSql: (node) => {
    return sql.p(node.value);
  },
});
