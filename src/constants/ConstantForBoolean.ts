import type { GenericAny } from '@/core-utils';
import { createAstNode } from '../createAstNode';
import { createDataTypeBoolean, type DataTypeBoolean } from '../DataType';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForBoolean<Value extends boolean = boolean>
  extends ConstantBase<DataTypeBoolean<Value>> {
  type: 'boolean';
  value: Value;
  inferredAliases: [];
}

export const constantForBoolean = createAstNode<
  ConstantForBoolean<GenericAny>
>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'boolean',
  create: <T extends boolean = boolean>(value: T): ConstantForBoolean<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as GenericAny,
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
