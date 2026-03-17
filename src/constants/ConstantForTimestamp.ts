import type { GenericAny } from '../core-utils';
import { createAstNode } from '../createAstNode';
import { createDataTypeTimestamp, type DataTypeTimestamp } from '../DataType';
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
      columnReferences: [] as GenericAny,
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
