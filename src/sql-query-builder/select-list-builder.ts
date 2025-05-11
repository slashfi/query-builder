import type { BaseDbDiscriminator } from '../Base';
import type { ExpressionBuilder } from '../ExpressionBuilder';
import {
  type QueryBuilderParams,
  type SetQbParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import {
  type ClauseForSelectListItem,
  clauseForSelectListItem,
} from '../clauses/ClauseForSelectListItem';
import { expressionColumn } from '../expressions/ExpressionColumn';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './SqlQueryBuilder';

export const createSqlQueryBuilderSelect = <S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>
): SqlQueryBuilderSelect<any, S> => {
  return (...selectionArray) => {
    return createSqlQueryBuilder(
      updateQueryBuilderParams(params, {
        select: qbSelectListToSelectClause(selectionArray),
      })
    );
  };
};

export type SqlQueryBuilderSelect<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = <const Values extends ReadonlyArray<QbSelectListItem<S>>>(
  ...values: Values
) => AssertSqlQueryBuilder<
  SetQbParams<
    Params,
    {
      select: QbSelectListToSelectClause<Values, S>;
      isExplicitSelect: true;
    },
    S
  >,
  S
>;

export function qbSelectListToSelectClause<
  T extends ReadonlyArray<QbSelectListItem<S>>,
  S extends BaseDbDiscriminator,
>(items: T): QbSelectListToSelectClause<T, S> {
  return items.map((item) => {
    if (Array.isArray(item)) {
      return clauseForSelectListItem.create(item[0]._expression, item[1]);
    }

    if (!('_expression' in item)) {
      throw new Error('Invalid value passed into select');
    }

    if (expressionColumn.isNode(item._expression)) {
      return clauseForSelectListItem.create(
        item._expression,
        `${item._expression.tableAlias}_${item._expression.value}`
      );
    }

    return clauseForSelectListItem.create(item._expression);
  }) as QbSelectListToSelectClause<T, S>;
}

export type QbSelectListToSelectClause<
  Values extends ReadonlyArray<QbSelectListItem<S>>,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof Values]: Values[Key] extends readonly [
    expression: ExpressionBuilder<any, S>,
    alias: string,
  ]
    ? ClauseForSelectListItem<Values[Key][0]['_expression'], Values[Key][1]>
    : Values[Key] extends ExpressionBuilder<any, S>
      ? ClauseForSelectListItem<Values[Key]['_expression'], undefined>
      : never;
};

export type QbSelectListItem<S extends BaseDbDiscriminator> =
  | readonly [expression: ExpressionBuilder<any, S>, alias: string]
  | ExpressionBuilder<any, S>;
