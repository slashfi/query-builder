import { assertUnreachable, type GenericAny } from '@/core-utils';
import { createAstNode } from '../createAstNode';
import { createDataTypeBoolean, type DataTypeBoolean } from '../DataType';
import { sql } from '../sql-string';
import type { OperatorBinaryBase } from './base';

type LogicalOptions = 'AND' | 'OR';
export interface OperatorBinaryLogical<Logical extends LogicalOptions>
  extends OperatorBinaryBase {
  type: 'logical';
  value: Logical;
  supportedDataTypes: [DataTypeBoolean<GenericAny>];
}

export const operatorBinaryLogical = createAstNode<
  OperatorBinaryLogical<LogicalOptions>
>()({
  class: 'operator',
  variant: 'binary_operator',
  type: 'logical',
  create: <T extends LogicalOptions>(option: T): OperatorBinaryLogical<T> => ({
    class: 'operator',
    type: 'logical',
    value: option,
    supportedDataTypes: [createDataTypeBoolean({ isNullable: false })],
    variant: 'binary_operator',
  }),
  writeSql: (node) => {
    switch (node.value) {
      case 'AND':
        return sql`AND`;
      case 'OR':
        return sql`OR`;
      default:
        return assertUnreachable(node.value);
    }
  },
});
