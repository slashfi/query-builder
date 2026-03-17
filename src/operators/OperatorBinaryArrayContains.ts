import type { GenericAny } from '@/core-utils';
import { createAstNode } from '../createAstNode';
import {
  createDataTypeArray,
  createDataTypeBoolean,
  createDataTypeDecimal,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeTimestamp,
  createDataTypeVarchar,
  type DataTypeArray,
  type DataTypeNull,
  type DataTypeUnion,
} from '../DataType';
import { sql } from '../sql-string';
import type { OperatorBinaryBase } from './base';

export interface OperatorBinaryArrayContains extends OperatorBinaryBase {
  type: 'array_contains';
  value: '@>';
  supportedDataTypes: (
    | DataTypeArray<GenericAny>
    | DataTypeUnion<[DataTypeArray<GenericAny>, DataTypeNull]>
  )[];
}

export const operatorBinaryArrayContains =
  createAstNode<OperatorBinaryArrayContains>()({
    class: 'operator',
    variant: 'binary_operator',
    type: 'array_contains',
    create: (): OperatorBinaryArrayContains => ({
      class: 'operator',
      type: 'array_contains',
      value: '@>',
      supportedDataTypes: [
        createDataTypeArray(createDataTypeVarchar({ isNullable: false }), {
          isNullable: false,
        }),
        createDataTypeArray(createDataTypeVarchar({ isNullable: false }), {
          isNullable: true,
        }),
        createDataTypeArray(createDataTypeInteger({ isNullable: false }), {
          isNullable: false,
        }),
        createDataTypeArray(createDataTypeInteger({ isNullable: false }), {
          isNullable: true,
        }),
        createDataTypeArray(createDataTypeBoolean({ isNullable: false }), {
          isNullable: false,
        }),
        createDataTypeArray(createDataTypeBoolean({ isNullable: false }), {
          isNullable: true,
        }),
        createDataTypeArray(createDataTypeFloat({ isNullable: false }), {
          isNullable: false,
        }),
        createDataTypeArray(createDataTypeFloat({ isNullable: false }), {
          isNullable: true,
        }),
        createDataTypeArray(createDataTypeDecimal({ isNullable: false }), {
          isNullable: false,
        }),
        createDataTypeArray(createDataTypeDecimal({ isNullable: false }), {
          isNullable: true,
        }),
        createDataTypeArray(createDataTypeTimestamp({ isNullable: false }), {
          isNullable: false,
        }),
        createDataTypeArray(createDataTypeTimestamp({ isNullable: false }), {
          isNullable: true,
        }),
      ],
      variant: 'binary_operator',
    }),
    writeSql: (_node) => {
      return sql`@>`;
    },
  });
