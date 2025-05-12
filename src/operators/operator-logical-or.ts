import { assertUnreachable } from '@/core-utils';
import { createAstNode } from '../create-ast-node';
import { sql } from '../sql-string';
import type { OperatorLogicalBase } from './base';

export interface OperatorLogicalOr extends OperatorLogicalBase {
  type: 'or';
  value: 'OR';
}

export const operatorLogicalOr = createAstNode<OperatorLogicalOr>()({
  class: 'operator',
  variant: 'logical_operator',
  type: 'or',
  create: () => ({
    class: 'operator',
    variant: 'logical_operator',
    type: 'or',
    value: 'OR',
  }),
  writeSql: (node) => {
    switch (node.value) {
      case 'OR':
        return sql` OR `;
      default:
        throw assertUnreachable(node.value);
    }
  },
});
