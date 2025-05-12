import { assertUnreachable } from '@/core-utils';
import { createAstNode } from '../create-ast-node';
import { sql } from '../sql-string';
import type { OperatorLogicalBase } from './base';

export interface OperatorLogicalAnd extends OperatorLogicalBase {
  type: 'and';
  value: 'AND';
}

export const operatorLogicalAnd = createAstNode<OperatorLogicalAnd>()({
  class: 'operator',
  variant: 'logical_operator',
  type: 'and',
  create: () => ({
    class: 'operator',
    variant: 'logical_operator',
    type: 'and',
    value: 'AND',
  }),
  writeSql: (node) => {
    switch (node.value) {
      case 'AND':
        return sql` AND `;
      default:
        throw assertUnreachable(node.value);
    }
  },
});
