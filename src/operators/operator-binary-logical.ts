import { assertUnreachable } from '@/core-utils';
import { createAstNode } from '../create-ast-node';
import { type DataTypeBoolean, createDataTypeBoolean } from '../data-type';
import { sql } from '../sql-string';
import type { OperatorBinaryBase } from './base';

type LogicalOptions = 'AND' | 'OR';
export interface OperatorBinaryLogical<Logical extends LogicalOptions>
  extends OperatorBinaryBase {
  type: 'logical';
  value: Logical;
  supportedDataTypes: [DataTypeBoolean<any>];
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
        throw assertUnreachable(node.value);
    }
  },
});
