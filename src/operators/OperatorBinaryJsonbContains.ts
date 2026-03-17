import type { GenericAny } from '@/core-utils';
import { createAstNode } from '../createAstNode';
import {
  createDataTypeJson,
  type DataTypeJson,
  type DataTypeNull,
  type DataTypeUnion,
} from '../DataType';
import { sql } from '../sql-string';
import type { OperatorBinaryBase } from './base';

export interface OperatorBinaryJsonbContains extends OperatorBinaryBase {
  type: 'jsonb_contains';
  value: '@>';
  supportedDataTypes: (
    | DataTypeJson<GenericAny>
    | DataTypeUnion<[DataTypeJson<GenericAny>, DataTypeNull]>
  )[];
}

export const operatorBinaryJsonbContains =
  createAstNode<OperatorBinaryJsonbContains>()({
    class: 'operator',
    variant: 'binary_operator',
    type: 'jsonb_contains',
    create: (): OperatorBinaryJsonbContains => ({
      class: 'operator',
      type: 'jsonb_contains',
      value: '@>',
      supportedDataTypes: [
        createDataTypeJson({ isNullable: false }),
        createDataTypeJson({ isNullable: true }),
      ],
      variant: 'binary_operator',
    }),
    writeSql: (_node) => {
      return sql`@>`;
    },
  });
