import type { IsAny } from '@/core-utils';
import {
  type QueryBuilderParams,
  type SelectionArray,
  type SetQbParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import type { BaseDbDiscriminator, ExpressionBase } from '../base';
import {
  type ClauseForGroupByList,
  clauseForGroupByList,
} from '../clauses/clause-for-group-by';
import type { ClauseForSelectListItem } from '../clauses/clausefor-select-list-item';
import type { ExpressionBuilder } from '../expression-builder-type';
import type { ExpressionColumn } from '../expressions/expression-column';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './sql-query-builder';

export const createSqlQueryBuilderGroupBy =
  <S extends BaseDbDiscriminator>(
    params: QueryBuilderParams<S>
  ): SqlQueryBuilderGroupBy<any, S> =>
  (...values) => {
    const arr = [...values].map((expression) => {
      if (typeof expression === 'string') {
        return clauseForGroupByList.create(params, expression);
      } else {
        return clauseForGroupByList.create(params, [
          expression._expression.tableAlias,
          expression._expression.value,
        ]);
      }
    });

    return createSqlQueryBuilder(
      updateQueryBuilderParams(params, {
        groupByClause: arr as ReadonlyArray<(typeof arr)[number]>,
      })
    );
  };

/**
 * Function that takes in a list of Group By items and sets the query builder params
 */
export type SqlQueryBuilderGroupBy<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = <
  const Values extends readonly [
    GroupByItemParameterItem<Params, S>,
    ...ReadonlyArray<GroupByItemParameterItem<Params, S>>,
  ],
>(
  ...values: Values
) => AssertSqlQueryBuilder<
  SetQbParams<
    Params,
    {
      groupByClause: ClausesToGroupBy<Params, Values, S>;
    },
    S
  >,
  S
>;

type AliasesInSelectList<Arr extends SelectionArray> = IsAny<Arr> extends true
  ? string[]
  : Arr extends readonly [infer U, ...infer J extends SelectionArray]
    ? U extends ClauseForSelectListItem<ExpressionBase<any>, undefined>
      ? [
          NonNullable<U['expression']['inferredAliases']>[number],
          ...AliasesInSelectList<J>,
        ]
      : /**
         * should only be able to reference items in the SELECT list that don't have aliases
         * if they are vanilla column expression
         */
        U extends ClauseForSelectListItem<ExpressionBase<any>, string>
        ? [U['alias'], ...AliasesInSelectList<J>]
        : []
    : [];

export type ColumnsSelectList<Arr extends SelectionArray> =
  IsAny<Arr> extends true
    ? {}
    : Arr extends readonly [infer U, ...infer J extends SelectionArray]
      ? U extends ClauseForSelectListItem<ExpressionBase<any>, undefined>
        ? {
            [Key in NonNullable<
              U['expression']['inferredAliases']
            >[number]]: U['dataType'];
          } & ColumnsSelectList<J>
        : /**
           * should only be able to reference items in the SELECT list that don't have aliases
           * if they are vanilla column expression
           */
          U extends ClauseForSelectListItem<ExpressionBase<any>, string>
          ? { [Key in U['alias']]: U['dataType'] } & ColumnsSelectList<J>
          : {}
      : {};

export type GroupByItemParameterItem<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> =
  | AliasesInSelectList<Params['select']>[number]
  | ExpressionBuilder<ExpressionColumn<any, any, S>, S>;

export type ClausesToGroupBy<
  Params extends QueryBuilderParams<S>,
  T extends ReadonlyArray<GroupByItemParameterItem<Params, S>>,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof T]: T[Key] extends ExpressionBuilder<
    ExpressionColumn<infer Base, infer Column extends string, S>,
    S
  >
    ? ClauseForGroupByList<[Base['alias'], Column]>
    : T[Key] extends string
      ? ClauseForGroupByList<T[Key]>
      : never;
};
