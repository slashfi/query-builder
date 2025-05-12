import type { AllOf, AnyOf, IsAny, Not } from '@/core-utils';
import type {
  CanJoin,
  CanLimit,
  CanOrderBy,
  CanSelect,
  CanWhere,
  QueryBuilderParams,
  SetQbParams,
} from './QueryBuilderParams';
import type { BaseDbDiscriminator, ExpressionBase, TableBase } from './base';
import type { ClauseForOrderByList } from './clauses/clause-for-order-by';
import type { ClauseFromExpression } from './clauses/clause-from-expression';
import type { ClauseForSelectListItem } from './clauses/clausefor-select-list-item';
import type { ConditionParams, SetConditionParams } from './conditional-params';
import type { DataTypeBoolean } from './data-type';
import type { EntityTarget, GenericEntityTarget } from './entity-target';
import type { ExpressionBuilderShape } from './expression-builder-type';
import type { ExpressionLeftRightBinary } from './expressions/expression-left-right-binary';
import type { ExpressionSelectColumns } from './expressions/expression-select-columns';
import type {
  InferAlias,
  LeftJoinTarget,
  RightJoinTarget,
  SelectBuilderToTable,
} from './from-builder';
import type { OperatorBinaryLogical } from './operators/operator-binary-logical';
import type { AssertSelectQueryBuilder } from './query-builder-asserter';
import type { BaseResult, QueryResult } from './query-result';
import type {
  ClausesToGroupBy,
  GroupByItemParameterItem,
} from './sql-query-builder/group-by-list-builder';
import type {
  BuildOrderByParameterItem,
  ToOrderByList,
} from './sql-query-builder/order-by-builder';
import type {
  QbSelectListItem,
  QbSelectListToSelectClause,
} from './sql-query-builder/select-list-builder';
import type { SqlString } from './sql-string';
import type { TableSelector } from './table-selector';
import type { TypeNarrowResult } from './type-narrower';

type QueryResultFromThenable<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = QueryResult<
  Params,
  {
    applyTypeNarrowing: false;
    throwsIfEmpty: false;
  },
  S
> extends infer Result
  ? Result extends Array<infer U>
    ? // if there is only one entity, we can "unkey" the result by the alias
      // and flatten the result. Otherwise, we don't touch the result
      Params['entities'] extends [{ alias: infer Alias extends string }]
      ? // check if the result has the key of the alias
        Result extends [infer SingleResult | undefined]
        ? Alias extends keyof SingleResult
          ? Params['throwsIfEmpty'] extends true
            ? [UnkeyAliasFromResult<SingleResult, Alias>]
            : [UnkeyAliasFromResult<SingleResult, Alias> | undefined]
          : Params['throwsIfEmpty'] extends true
            ? [BaseResult<Params, S>]
            : [BaseResult<Params, S> | undefined]
        : UnkeyAliasFromResult<U, Alias>[]
      : U[]
    : never
  : never;

type UnkeyAliasFromResult<Row, Alias extends string> = Alias extends keyof Row
  ? Row[Alias]
  : Row;

type SelectQueryBuilderThenable<
  Params extends QueryBuilderParams<S>,
  T,
  S extends BaseDbDiscriminator,
> = T & PromiseLike<QueryResultFromThenable<Params, S>>;

export type SelectQueryBuilder<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = SelectQueryBuilderThenable<
  Params,
  {
    _debug(): Params;
    setQueryName: (
      queryName: string
    ) => SelectQueryBuilder<SetQbParams<Params, { queryName: string }, S>, S>;
    asTable<Alias extends string>(
      alias: Alias
    ): SelectBuilderToTable<
      { _debug(): Params },
      Alias,
      S
    > extends infer U extends TableBase<S>
      ? EntityTarget<U, S>
      : never;
    leftJoin: CanJoin<Params, S> extends true
      ? QueryBuilderLeftJoin<Params, S>
      : never;
    rightJoin: CanJoin<Params, S> extends true
      ? QueryBuilderRightJoin<Params, S>
      : never;
    select: CanSelect<Params, S> extends true
      ? <const Values extends ReadonlyArray<QbSelectListItem<S>>>(
          fn: (clause: TableSelector<Params['entities'], S>) => Values
        ) => AssertSelectQueryBuilder<
          SetQbParams<
            Params,
            {
              select: QbSelectListToSelectClause<Values, S>;
              isExplicitSelect: true;
            },
            S
          >,
          S
        >
      : never;
    where: CanWhere<Params, S> extends true
      ? <BooleanExpr extends ExpressionBase<DataTypeBoolean>>(
          fn: (
            clause: TableSelector<Params['entities'], S>
          ) => ExpressionBuilderShape<BooleanExpr>
        ) => AssertSelectQueryBuilder<
          SetQbParams<
            Params,
            {
              whereClause: ClauseFromExpression<BooleanExpr>;
            },
            S
          >,
          S
        >
      : never;
    groupBy: <
      const Values extends readonly [
        GroupByItemParameterItem<Params, S>,
        ...ReadonlyArray<GroupByItemParameterItem<Params, S>>,
      ],
    >(
      fn: (selector: TableSelector<Params['entities'], S>) => Values
    ) => AssertSelectQueryBuilder<
      SetQbParams<
        Params,
        {
          groupByClause: ClausesToGroupBy<Params, Values, S>;
        },
        S
      >,
      S
    >;
    limit: CanLimit<Params, S> extends true
      ? <Value extends number>(
          value: Value
        ) => AssertSelectQueryBuilder<
          SetQbParams<Params, { limit: Value }, S>,
          S
        >
      : never;
    orderBy: CanOrderBy<Params, S> extends true
      ? <const Values extends ReadonlyArray<BuildOrderByParameterItem<S>>>(
          fn: (clause: TableSelector<Params['entities'], S>) => Values
        ) => AssertSelectQueryBuilder<
          SetQbParams<
            Params,
            { orderBy: ClauseForOrderByList<ToOrderByList<Values, S>> },
            S
          >,
          S
        >
      : never;
    assertResultsCondition: <Condition extends ConditionParams>(
      fn: (
        params: ResultAssertBuilder<Params, S>
      ) => ResultAssertBuilder<
        SetQbParams<Params, { conditions: Condition }, S>,
        S
      >
    ) => AssertSelectQueryBuilder<
      SetQbParams<
        Params,
        {
          conditions: Condition;
        },
        S
      >,
      S
    >;
    getSqlString(): SqlString;
    addTypeNarrower<BooleanExpr extends ExpressionBase<DataTypeBoolean>>(
      fn: (
        params: TableSelector<Params['entities'], S>
      ) => ExpressionBuilderShape<BooleanExpr>
    ): AssertSelectQueryBuilder<
      SetQbParams<
        Params,
        {
          conditions: SetConditionParams<
            Params['conditions'],
            {
              filter: undefined extends Params['conditions']
                ? ClauseFromExpression<BooleanExpr>
                : undefined extends NonNullable<Params['conditions']>['filter']
                  ? ClauseFromExpression<BooleanExpr>
                  : ClauseFromExpression<
                      ExpressionLeftRightBinary<
                        NonNullable<
                          NonNullable<Params['conditions']>['filter']
                        >['expr'],
                        OperatorBinaryLogical<'AND'>,
                        BooleanExpr
                      >
                    >;
            }
          >;
        },
        S
      >,
      S
    >;
    /**
     * Throws if nothing is returned (aka empty array)
     */
    throwsIfEmpty<Err extends Error = never>(
      throwFn?: (() => Err) | undefined
    ): AssertSelectQueryBuilder<
      SetQbParams<
        Params,
        { throwsIfEmpty: Err extends () => Error ? Err : true },
        S
      >,
      S
    >;
    /**
     * @deprecated - await any part of the query builder directly
     *
     * This is legacy behavior and should be removed in the future
     */
    query: <Throws extends boolean | (() => Error) = false>(options?: {
      throwsIfEmpty?: Throws;
      paginate?: {
        limit: number;
      };
    }) => Promise<{
      result: QueryResult<
        Params,
        {
          applyTypeNarrowing: false;
          throwsIfEmpty: AnyOf<
            [
              Throws extends true ? true : false,
              Throws extends Error ? true : false,
              Params['throwsIfEmpty'] extends true
                ? true
                : Params['throwsIfEmpty'] extends () => Error
                  ? true
                  : false,
            ]
          >;
        },
        S
      >;
      sql: SqlString;
      typeNarrowResult:
        | TypeNarrowResult
        | (AllOf<
            [
              undefined extends Params['conditions'] ? false : true,
              Not<IsAny<Params>>,
            ]
          > extends true
            ? never
            : undefined);
    }>;
    queryAndNarrow(): Promise<{
      result: QueryResult<
        Params,
        {
          applyTypeNarrowing: true;
          throwsIfEmpty: false;
        },
        S
      >;
      sql: SqlString;
    }>;
  },
  S
>;

export interface SelectQueryBuilderShape<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> {
  _debug(): Params;
}

export interface ResultAssertBuilder<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> {
  _getAst(): Params['conditions'];
  length<T extends number>(
    length: T
  ): ResultAssertBuilder<
    SetQbParams<
      Params,
      {
        conditions: SetConditionParams<
          Params['conditions'],
          {
            length: T;
          }
        >;
      },
      S
    >,
    S
  >;
}

export type QueryBuilderLeftJoin<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = <
  EntityTarget extends GenericEntityTarget<S>,
  BooleanExpr extends ExpressionBase<DataTypeBoolean>,
  Alias extends string = never,
>(
  target: EntityTarget,
  options: {
    alias?: Alias;
    index?: string;
    on: (
      qb: TableSelector<
        readonly [
          ...Params['entities'],
          LeftJoinTarget<
            EntityTarget,
            InferAlias<EntityTarget, Alias, S>,
            BooleanExpr,
            S
          >,
        ],
        S
      >
    ) => ExpressionBuilderShape<BooleanExpr>;
  }
) => SelectQueryBuilder<
  SetQbParams<
    Params,
    {
      entities: [
        ...Params['entities'],
        LeftJoinTarget<
          EntityTarget,
          InferAlias<EntityTarget, Alias, S>,
          BooleanExpr,
          S
        >,
      ];
      select: [
        ...Params['select'],
        ClauseForSelectListItem<
          ExpressionSelectColumns<
            LeftJoinTarget<
              EntityTarget,
              InferAlias<EntityTarget, Alias, S>,
              BooleanExpr,
              S
            >,
            keyof LeftJoinTarget<
              EntityTarget,
              InferAlias<EntityTarget, Alias, S>,
              BooleanExpr,
              S
            >['table']['columnSchema'],
            S
          >,
          Alias
        >,
      ];
    },
    S
  >,
  S
>;

export type QueryBuilderRightJoin<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = <
  EntityTarget extends GenericEntityTarget<S>,
  BooleanExpr extends ExpressionBase<DataTypeBoolean>,
  Alias extends string = never,
>(
  target: EntityTarget,
  options: {
    alias?: Alias;
    index?: string;
    on: (
      qb: TableSelector<
        readonly [
          ...Params['entities'],
          RightJoinTarget<
            EntityTarget,
            InferAlias<EntityTarget, Alias, S>,
            BooleanExpr,
            S
          >,
        ],
        S
      >
    ) => ExpressionBuilderShape<BooleanExpr>;
  }
) => SelectQueryBuilder<
  SetQbParams<
    Params,
    {
      entities: [
        ...Params['entities'],
        RightJoinTarget<
          EntityTarget,
          InferAlias<EntityTarget, Alias, S>,
          BooleanExpr,
          S
        >,
      ];
      select: [
        ...Params['select'],
        ClauseForSelectListItem<
          ExpressionSelectColumns<
            RightJoinTarget<
              EntityTarget,
              InferAlias<EntityTarget, Alias, S>,
              BooleanExpr,
              S
            >
          >,
          Alias
        >,
      ];
    },
    S
  >,
  S
>;

export type RowOutputForQueryParams<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = QueryResult<
  Params,
  {
    applyTypeNarrowing: false;
    throwsIfEmpty: false;
  },
  S
>[number];

export type RowOutputForQuery<
  Builder extends { _debug(): QueryBuilderParams<S> },
  S extends BaseDbDiscriminator,
> = QueryResult<
  ReturnType<Builder['_debug']>,
  {
    applyTypeNarrowing: false;
    throwsIfEmpty: false;
  },
  S
>[number];
