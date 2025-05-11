import { assertUnreachable } from '@/core-utils';
import type { DataTypeBase } from '../Base';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';
import type { OperatorUnaryBase } from './base';

export type UnaryOperatorOptions = 'NULL' | 'TRUE' | 'FALSE';

export interface OperatoryUnaryIs<
  Value extends UnaryOperatorOptions,
  Negated extends boolean,
> extends OperatorUnaryBase {
  type: 'is';
  value: Negated extends true ? `IS NOT ${Value}` : `IS ${Value}`;
  supportedDataTypes: [DataTypeBase];
  isNegated: Negated;
}

export const operatorUnaryIs = createAstNode<
  OperatoryUnaryIs<UnaryOperatorOptions, boolean>
>()({
  class: 'operator',
  variant: 'unary_operator',
  type: 'is',
  create: <Value extends UnaryOperatorOptions, Negated extends boolean>(
    value: Value,
    options?: { isNegated?: Negated }
  ): OperatoryUnaryIs<Value, Negated> => {
    return {
      class: 'operator',
      variant: 'unary_operator',
      type: 'is',
      isNegated: !!options?.isNegated as any,
      supportedDataTypes: [] as any,
      value: options?.isNegated ? `IS NOT ${value}` : (`IS ${value}` as any),
    };
  },
  writeSql: (node) => {
    switch (node.value) {
      case 'IS NOT NULL':
        return sql`IS NOT NULL`;
      case 'IS NOT TRUE':
        return sql`IS NOT TRUE`;
      case 'IS NOT FALSE':
        return sql`IS NOT FALSE`;
      case 'IS NULL':
        return sql`IS NULL`;
      case 'IS TRUE':
        return sql`IS TRUE`;
      case 'IS FALSE':
        return sql`IS FALSE`;
      default:
        throw assertUnreachable(node.value);
    }
  },
});
