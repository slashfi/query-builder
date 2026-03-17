import type { GenericAny } from '../core-utils';
import { getAstNodeRepository } from '../ast-node-repository';
import type { ClauseBase, ExpressionBase } from '../Base';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';

export interface ClauseForSelectListItem<
  Base extends ExpressionBase<GenericAny>,
  Alias extends string | undefined,
> extends ClauseBase<Base['dataType']> {
  variant: 'select_list_item';
  type: 'select_list_item';
  expression: Base;
  alias: Alias;
}

export const clauseForSelectListItem = createAstNode<
  ClauseForSelectListItem<ExpressionBase<GenericAny>, string | undefined>
>()({
  class: 'clause',
  variant: 'select_list_item',
  type: 'select_list_item',
  create: <
    Expr extends ExpressionBase<GenericAny>,
    Alias extends string | undefined = undefined,
  >(
    expr: Expr,
    alias?: Alias
  ): ClauseForSelectListItem<Expr, Alias> => {
    return {
      class: 'clause',
      variant: 'select_list_item',
      type: 'select_list_item',
      alias: alias as GenericAny,
      dataType: expr.dataType,
      expression: expr,
    };
  },
  writeSql: (node) => {
    const repo = getAstNodeRepository(node.expression);

    if (node.alias) {
      return sql`${repo.writeSql(node.expression, node)} as ${sql.escapeIdentifier(
        node.alias
      )}`;
    }

    return repo.writeSql(node.expression, node);
  },
});
