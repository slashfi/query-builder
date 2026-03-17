import { assertUnreachable, type GenericAny } from '../core-utils';
import { createAstNode } from '../createAstNode';
import {
  createDataTypeBoolean,
  createDataTypeDecimal,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeTimestamp,
  createDataTypeTuple,
  createDataTypeVarchar,
  type DataTypeBoolean,
  type DataTypeDecimal,
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeNull,
  type DataTypeTimestamp,
  type DataTypeTuple,
  type DataTypeUnion,
  type DataTypeVarchar,
} from '../DataType';
import { sql } from '../sql-string';
import type { OperatorBinaryBase } from './base';

export type BinaryComparatorOptions = '!=' | '<' | '<=' | '>' | '>=' | '=';
export interface OperatorBinaryComparator<
  Comparator extends BinaryComparatorOptions,
> extends OperatorBinaryBase {
  type: 'comparator';
  value: Comparator;
  supportedDataTypes: [
    DataTypeFloat<GenericAny>,
    DataTypeInteger<GenericAny>,
    DataTypeTimestamp<GenericAny>,
    DataTypeVarchar<GenericAny>,
    DataTypeBoolean<GenericAny>,
    DataTypeDecimal<GenericAny>,
    DataTypeUnion<[DataTypeFloat<GenericAny>, DataTypeNull]>,
    DataTypeUnion<[DataTypeInteger<GenericAny>, DataTypeNull]>,
    DataTypeUnion<[DataTypeTimestamp<GenericAny>, DataTypeNull]>,
    DataTypeUnion<[DataTypeVarchar<GenericAny>, DataTypeNull]>,
    DataTypeUnion<[DataTypeBoolean<GenericAny>, DataTypeNull]>,
    DataTypeUnion<[DataTypeDecimal<GenericAny>, DataTypeNull]>,
    DataTypeTuple<GenericAny>,
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
      createDataTypeDecimal({ isNullable: false }),
      createDataTypeFloat({ isNullable: true }),
      createDataTypeInteger({ isNullable: true }),
      createDataTypeTimestamp({ isNullable: true }),
      createDataTypeVarchar({ isNullable: true }),
      createDataTypeBoolean({ isNullable: true }),
      createDataTypeDecimal({ isNullable: true }),
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
        return assertUnreachable(node.value);
    }
  },
});
