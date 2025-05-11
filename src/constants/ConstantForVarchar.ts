import { type DataTypeVarchar, createDataTypeVarchar } from '../DataType';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForVarchar<T extends string = string>
  extends ConstantBase<DataTypeVarchar<T>> {
  type: 'varchar';
  value: T;
  inferredAliases: [];
}

export const constantForVarchar = createAstNode<ConstantForVarchar<any>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'varchar',
  create: <T extends string = string>(value: T): ConstantForVarchar<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [],
      dataType: createDataTypeVarchar({ isNullable: false }),
      inferredAliases: [],
      isAggregate: false,
      type: 'varchar',
      value,
    };
  },
  writeSql: (node) => {
    return sql.p(node.value);
  },
});
