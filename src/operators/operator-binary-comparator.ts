import { assertUnreachable } from '@/core-utils';
import { createAstNode } from '../create-ast-node';
import {
  type DataTypeBoolean,
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeNull,
  type DataTypeTimestamp,
  type DataTypeTuple,
  type DataTypeUnion,
  type DataTypeVarchar,
  createDataTypeBoolean,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeTimestamp,
  createDataTypeTuple,
  createDataTypeVarchar,
} from '../data-type';
import { sql } from '../sql-string';
import type { OperatorBinaryBase } from './base';

export type BinaryComparatorOptions = '!=' | '<' | '<=' | '>' | '>=' | '=';
export interface OperatorBinaryComparator<
  Comparator extends BinaryComparatorOptions,
> extends OperatorBinaryBase {
  type: 'comparator';
  value: Comparator;
  supportedDataTypes: [
    DataTypeFloat<any>,
    DataTypeInteger<any>,
    DataTypeTimestamp<any>,
    DataTypeVarchar<any>,
    DataTypeBoolean<any>,
    DataTypeUnion<[DataTypeFloat<any>, DataTypeNull]>,
    DataTypeUnion<[DataTypeInteger<any>, DataTypeNull]>,
    DataTypeUnion<[DataTypeTimestamp<any>, DataTypeNull]>,
    DataTypeUnion<[DataTypeVarchar<any>, DataTypeNull]>,
    DataTypeUnion<[DataTypeBoolean<any>, DataTypeNull]>,
    DataTypeTuple<any>,
  ];
}

export const operatorBinaryComparator = createAstNode<
  OperatorBinaryComparator<BinaryComparatorOptions>
>()({
  class: 'operator',
  variant: 'binary_operator',
  type: 'comparator',
  create: <T extends BinaryComparatorOptions>(
    option: T
  ): OperatorBinaryComparator<T> => ({
    class: 'operator',
    type: 'comparator',
    value: option,
    supportedDataTypes: [
      createDataTypeFloat({ isNullable: false }),
      createDataTypeInteger({ isNullable: false }),
      createDataTypeTimestamp({ isNullable: false }),
      createDataTypeVarchar({ isNullable: false }),
      createDataTypeBoolean({ isNullable: false }),
      createDataTypeFloat({ isNullable: true }),
      createDataTypeInteger({ isNullable: true }),
      createDataTypeTimestamp({ isNullable: true }),
      createDataTypeVarchar({ isNullable: true }),
      createDataTypeBoolean({ isNullable: true }),
      createDataTypeTuple([]),
    ],
    variant: 'binary_operator',
  }),
  writeSql: (node) => {
    switch (node.value) {
      case '!=':
        return sql`!=`;
      case '<':
        return sql`<`;
      case '<=':
        return sql`<=`;
      case '>':
        return sql`>`;
      case '>=':
        return sql`>=`;
      case '=':
        return sql`=`;
      default:
        throw assertUnreachable(node.value);
    }
  },
});
