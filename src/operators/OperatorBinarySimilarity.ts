import { assertUnreachable } from '@/core-utils';
import {
  type DataTypeNull,
  type DataTypeUnion,
  type DataTypeVarchar,
  createDataTypeVarchar,
} from '../DataType';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';
import type { OperatorBinaryBase } from './base';

type SimilarityOption = 'LIKE' | 'ILIKE' | 'SIMILAR';
export interface OperatoryBinarySimilarity<
  T extends SimilarityOption,
  Negated extends boolean,
> extends OperatorBinaryBase {
  type: 'string_similarity';
  value: T;
  isNegated: Negated;
  supportedDataTypes: [
    DataTypeVarchar<any>,
    DataTypeUnion<[DataTypeVarchar<any>, DataTypeNull]>,
  ];
}

export const operatorBinarySimilarity = createAstNode<
  OperatoryBinarySimilarity<SimilarityOption, boolean>
>()({
  class: 'operator',
  variant: 'binary_operator',
  type: 'string_similarity',
  create: <T extends SimilarityOption, Negated extends boolean = false>(
    value: T,
    options?: {
      isNegated?: Negated;
    }
  ): OperatoryBinarySimilarity<T, Negated> => {
    return {
      class: 'operator',
      variant: 'binary_operator',
      type: 'string_similarity',
      isNegated: !!options?.isNegated as Negated,
      supportedDataTypes: [
        createDataTypeVarchar({ isNullable: false }),
        createDataTypeVarchar({ isNullable: true }),
      ],
      value,
    };
  },
  writeSql: (node) => {
    switch (node.value) {
      case 'LIKE':
        return sql`LIKE`;
      case 'ILIKE':
        return sql`ILIKE`;
      case 'SIMILAR':
        return sql` % `;
      default:
        throw assertUnreachable(node.value);
    }
  },
});
