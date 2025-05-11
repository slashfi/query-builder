import { type DataTypeJson, createDataTypeJson } from '../DataType';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForJson<
  Value extends { [Key in string]: any } = {
    [Key in string]: any;
  },
> extends ConstantBase<DataTypeJson<Value>> {
  type: 'json';
  value: Value;
  inferredAliases: [];
}

export const constantForJson = createAstNode<ConstantForJson<any>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'json',
  create: <T extends { [Key in string]: any }>(
    value: T
  ): ConstantForJson<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as any,
      dataType: createDataTypeJson({ isNullable: false }),
      inferredAliases: [],
      isAggregate: false,
      type: 'json',
      value,
    };
  },
  writeSql: (node) => {
    return sql`CAST(${sql.p(JSON.stringify(node.value))} AS JSON)`;
  },
});
