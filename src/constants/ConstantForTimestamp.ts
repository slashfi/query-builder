import { type DataTypeTimestamp, createDataTypeTimestamp } from '../DataType';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForTimestamp extends ConstantBase<DataTypeTimestamp> {
  type: 'timestamp';
  value: Date;
  inferredAliases: [];
}

export const constantForTimestamp = createAstNode<ConstantForTimestamp>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'timestamp',
  create: (value: Date): ConstantForTimestamp => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as any,
      dataType: createDataTypeTimestamp({ isNullable: false }),
      inferredAliases: [],
      isAggregate: false,
      type: 'timestamp',
      value,
    };
  },
  writeSql: (node) => {
    return sql.p(node.value);
  },
});
