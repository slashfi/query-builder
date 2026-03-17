import type { AllOf, AnyOf, GenericAny, IsAny, Not } from '@/core-utils';
import type { BaseDbDiscriminator, ExpressionBase, TableBase } from './Base';
import type { ConditionParams, SetConditionParams } from './ConditionParams';
import type { ClauseForOrderByList } from './clauses/ClauseForOrderBy';
import type { ClauseForSelectListItem } from './clauses/ClauseForSelectListItem';
import type { ClauseFromExpression } from './clauses/ClauseFromExpression';
import type { DataTypeBoolean } from './DataType';
import type { EntityTarget, GenericEntityTarget } from './EntityTarget';
import type { ExpressionBuilderShape } from './ExpressionBuilder';
import type { ExpressionLeftRightBinary } from './expressions/ExpressionLeftRightBinary';
import type { ExpressionSelectColumns } from './expressions/ExpressionSelectColumns';
import type {
  InferAlias,
  InnerJoinTarget,
  JoinHint,
  LeftJoinTarget,
  RightJoinTarget,
} from './FromBuilder';
import type { SelectBuilderToTable } from './from-builder';
import type { OperatorBinaryLogical } from './operators/OperatorBinaryLogical';
import type {
  CanJoin,
  CanLimit,
  CanOffset,
  CanOrderBy,
  CanSelect,
  CanWhere,
  QueryBuilderParams,
  SetQbParams,
} from './QueryBuilderParams';
import type { BaseResult, QueryResult } from './QueryResult';
import type { AssertSelectQueryBuilder } from './query-builder-asserter';
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
          ? ThrowsIfEmpty<Params, S> extends true
            ? [UnkeyAliasFromResult<SingleResult, Alias>]
            : [UnkeyAliasFromResult<SingleResult, Alias> | undefined]
          : ThrowsIfEmpty<Params, S> extends true
            ? [BaseResult<Params, S>]
            : [BaseResult<Params, S> | undefined]
        : UnkeyAliasFromResult<U, Alias>[]
      : Result extends [infer SingleResult | undefined]
        ? ThrowsIfEmpty<Params, S> extends true
          ? [SingleResult]
          : [SingleResult | undefined]
        : U[]
    : never
  : never;

type ThrowsIfEmpty<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    Params['throwsIfEmpty'] extends true ? true : false,
    Params['throwsIfEmpty'] extends () => GenericAny ? true : false,
  ]
>;

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
    innerJoin: CanJoin<Params, S> extends true
      ? QueryBuilderInnerJoin<Params, S>
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
    forUpdate: (opts?: {
      skipLocked?: boolean;
    }) => AssertSelectQueryBuilder<
      SetQbParams<Params, { forUpdate: 'update' }, S>,
      S
    >;
    offset: CanOffset<Params, S> extends true
      ? <Value extends number>(
          value: Value
        ) => AssertSelectQueryBuilder<
          SetQbParams<Params, { offset: Value }, S>,
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
        { throwsIfEmpty: Err extends Error ? () => Err : true },
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
              Throws extends () => Error ? true : false,
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
    joinHint?: JoinHint | undefined;
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

export type QueryBuilderInnerJoin<
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
    joinHint?: JoinHint | undefined;
    on: (
      qb: TableSelector<
        readonly [
          ...Params['entities'],
          InnerJoinTarget<
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
        InnerJoinTarget<
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
            InnerJoinTarget<
              EntityTarget,
              InferAlias<EntityTarget, Alias, S>,
              BooleanExpr,
              S
            >,
            keyof InnerJoinTarget<
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
    joinHint?: JoinHint | undefined;
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
