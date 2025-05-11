import { type DataTypeInteger, createDataTypeInteger } from '../DataType';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForInteger<Value extends number = number>
  extends ConstantBase<DataTypeInteger<Value>> {
  type: 'int';
  value: Value;
  inferredAliases: [];
}

export const constantForInteger = createAstNode<ConstantForInteger<any>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'int',
  create: <T extends number = number>(value: T): ConstantForInteger<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as any,
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
