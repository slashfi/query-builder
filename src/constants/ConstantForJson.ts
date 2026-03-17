import type { GenericAny } from '../core-utils';
import { createAstNode } from '../createAstNode';
import { createDataTypeJson, type DataTypeJson } from '../DataType';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForJson<
  Value extends { [Key in string]: GenericAny } = {
    [Key in string]: GenericAny;
  },
> extends ConstantBase<DataTypeJson<Value>> {
  type: 'json';
  value: Value;
  inferredAliases: [];
}

export const constantForJson = createAstNode<ConstantForJson<GenericAny>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'json',
  create: <T extends { [Key in string]: GenericAny }>(
    value: T
  ): ConstantForJson<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as GenericAny,
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
