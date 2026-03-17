import type {
  DropNeverKeys,
  GenericAny,
  IsAny,
  TypecheckError,
} from './core-utils';
import type { BaseDbDiscriminator, ExpressionBase } from './Base';
import type { ClauseForGroupByList } from './clauses/ClauseForGroupBy';
import type { ClauseForSelectListItem } from './clauses/ClauseForSelectListItem';
import type { ExpressionColumn } from './expressions/ExpressionColumn';
import type { GetEntityFromTargetList, TargetBase } from './FromBuilder';
import type { SelectQueryBuilder } from './QueryBuilder';
import type { QueryBuilderParams, SelectionArray } from './QueryBuilderParams';
import type { SqlQueryBuilder } from './sql-query-builder/SqlQueryBuilder';
import type {
  CheckForTypecheckError,
  FilterNeverValuesFromReadonlyArray,
  SomeValueInFirstExtendsSecond,
} from './util';

type AssertQbParams<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = Params['groupByClause'] extends infer GroupBy extends ReadonlyArray<
  ClauseForGroupByList<GenericAny>
>
  ? IsAny<Params> extends true
    ? Params
    : CheckForTypecheckError<
          AssertSelectColumns<
            Params['select'],
            GroupColumns<Params['entities'], GroupBy, S>,
            S
          >
        > extends infer Error extends TypecheckError<GenericAny, GenericAny>
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
  WhitelistColumns extends ReadonlyArray<
    ExpressionColumn<GenericAny, GenericAny, S>
  >,
  S extends BaseDbDiscriminator,
> = T extends readonly [infer U, ...infer J extends SelectionArray]
  ? U extends ClauseForSelectListItem<
      infer U extends ExpressionBase<GenericAny>,
      string | undefined
    >
    ? [
        AssertSingleSelectColumn<U, WhitelistColumns, S>,
        ...AssertSelectColumns<J, WhitelistColumns, S>,
      ]
    : []
  : [];

type AssertSingleSelectColumn<
  T extends ExpressionBase<GenericAny>,
  WhitelistColumns extends ReadonlyArray<
    ExpressionColumn<GenericAny, GenericAny, S>
  >,
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
    [column: ExpressionColumn<GenericAny, GenericAny, S>, isAggregate: boolean]
  >,
  S extends BaseDbDiscriminator,
> = FilterNeverValuesFromReadonlyArray<GetNonAggregateColumnsBase<Expr, S>>;

type GetNonAggregateColumnsBase<
  Expr extends ReadonlyArray<
    [column: ExpressionColumn<GenericAny, GenericAny, S>, isAggregate: boolean]
  >,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof Expr]: Expr[Key] extends [
    infer U extends ExpressionColumn<GenericAny, GenericAny, S>,
    false,
  ]
    ? U
    : never;
};

type GroupColumns<
  Entities extends ReadonlyArray<TargetBase<S>>,
  GroupBy extends ReadonlyArray<ClauseForGroupByList<GenericAny>>,
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
