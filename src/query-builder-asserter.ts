import type { DropNeverKeys, IsAny, TypecheckError } from '@/core-utils';
import type { QueryBuilderParams, SelectionArray } from './QueryBuilderParams';
import type { BaseDbDiscriminator, ExpressionBase } from './base';
import type { ClauseForGroupByList } from './clauses/clause-for-group-by';
import type { ClauseForSelectListItem } from './clauses/clausefor-select-list-item';
import type { ExpressionColumn } from './expressions/expression-column';
import type { GetEntityFromTargetList, TargetBase } from './from-builder';
import type { SelectQueryBuilder } from './query-builder';
import type { SqlQueryBuilder } from './sql-query-builder/sql-query-builder';
import type {
  CheckForTypecheckError,
  FilterNeverValuesFromReadonlyArray,
  SomeValueInFirstExtendsSecond,
} from './util';

type AssertQbParams<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = Params['groupByClause'] extends infer GroupBy extends ReadonlyArray<
  ClauseForGroupByList<any>
>
  ? IsAny<Params> extends true
    ? Params
    : CheckForTypecheckError<
          AssertSelectColumns<
            Params['select'],
            GroupColumns<Params['entities'], GroupBy, S>,
            S
          >
        > extends infer Error extends TypecheckError<any, any>
      ? Error
      : Params
  : never;

/**
 * Asserts that the query builder parameters are valid
 * and returns a new SqlQueryBuilder
 */
export type AssertSqlQueryBuilder<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AssertQbParams<Params, S> extends infer U
  ? U extends QueryBuilderParams<S>
    ? DropNeverKeys<SqlQueryBuilder<U, S>>
    : U
  : never;

/**
 *
 */
export type AssertSelectQueryBuilder<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AssertQbParams<Params, S> extends infer U
  ? U extends QueryBuilderParams<S>
    ? DropNeverKeys<SelectQueryBuilder<U, S>>
    : U
  : never;

type AssertSelectColumns<
  T extends SelectionArray,
  WhitelistColumns extends ReadonlyArray<ExpressionColumn<any, any, S>>,
  S extends BaseDbDiscriminator,
> = T extends readonly [infer U, ...infer J extends SelectionArray]
  ? U extends ClauseForSelectListItem<
      infer U extends ExpressionBase<any>,
      string | undefined
    >
    ? [
        AssertSingleSelectColumn<U, WhitelistColumns, S>,
        ...AssertSelectColumns<J, WhitelistColumns, S>,
      ]
    : []
  : [];

type AssertSingleSelectColumn<
  T extends ExpressionBase<any>,
  WhitelistColumns extends ReadonlyArray<ExpressionColumn<any, any, S>>,
  S extends BaseDbDiscriminator,
> = SomeValueInFirstExtendsSecond<
  GetNonAggregateColumnsInSelect<T['columnReferences'], S>,
  WhitelistColumns
> extends true
  ? T
  : WhitelistColumns extends []
    ? T
    : GetNonAggregateColumnsInSelect<T['columnReferences'], S> extends []
      ? T
      : TypecheckError<
          `Columns "${T['columnReferences'][number][0]['value']}" are not in the GROUP BY clause and can only be selected in an aggregate expression.`,
          {
            invalidColumns: GetNonAggregateColumnsInSelect<
              T['columnReferences'],
              S
            >;
          }
        >;

type GetNonAggregateColumnsInSelect<
  Expr extends ReadonlyArray<
    [column: ExpressionColumn<any, any, S>, isAggregate: boolean]
  >,
  S extends BaseDbDiscriminator,
> = FilterNeverValuesFromReadonlyArray<GetNonAggregateColumnsBase<Expr, S>>;

type GetNonAggregateColumnsBase<
  Expr extends ReadonlyArray<
    [column: ExpressionColumn<any, any, S>, isAggregate: boolean]
  >,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof Expr]: Expr[Key] extends [
    infer U extends ExpressionColumn<any, any, S>,
    false,
  ]
    ? U
    : never;
};

type GroupColumns<
  Entities extends ReadonlyArray<TargetBase<S>>,
  GroupBy extends ReadonlyArray<ClauseForGroupByList<any>>,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof GroupBy]: GroupBy[Key] extends ClauseForGroupByList<
    [infer TableAlias extends string, infer ColumnAlias extends string]
  >
    ? ExpressionColumn<
        GetEntityFromTargetList<Entities, TableAlias, S>,
        ColumnAlias,
        S
      >
    : never;
};
