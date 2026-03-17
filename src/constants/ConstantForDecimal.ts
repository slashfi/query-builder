import type { GenericAny } from '@/core-utils';
import { createAstNode } from '../createAstNode';
import { createDataTypeDecimal, type DataTypeDecimal } from '../DataType';
import { sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForDecimal<Value extends string | bigint = string>
  extends ConstantBase<DataTypeDecimal<Value>> {
  type: 'decimal';
  value: Value;
  inferredAliases: [];
}

export const constantForDecimal = createAstNode<
  ConstantForDecimal<GenericAny>
>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'decimal',
  create: <T extends string | bigint = string>(
    value: T
  ): ConstantForDecimal<T> => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as GenericAny,
      dataType: createDataTypeDecimal({
        isNullable: false,
      }) as DataTypeDecimal<T>,
      inferredAliases: [],
      isAggregate: false,
      type: 'decimal',
      value,
    };
  },
  writeSql: (node) => {
    // Convert bigint to string for SQL
    const sqlValue =
      typeof node.value === 'bigint' ? node.value.toString() : node.value;
    return sql.p(sqlValue);
  },
});
