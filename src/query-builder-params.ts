import type { AllOf, AnyOf, Expand, IsAny } from '@/core-utils';
import type { BaseDbDiscriminator, ExpressionBase } from './base';
import type { ClauseForGroupByList } from './clauses/clause-for-group-by';
import type { ClauseForOrderByList } from './clauses/clause-for-order-by';
import type { ClauseFromExpression } from './clauses/clause-from-expression';
import type { ClauseForSelectListItem } from './clauses/clausefor-select-list-item';
import type { ConditionParams } from './conditional-params';
import type { DataTypeBoolean } from './data-type';
import type { TargetBase } from './from-builder';

/**
 * The object that the query builder adds to
 * in order to build the final query
 */
export interface QueryBuilderParams<S extends BaseDbDiscriminator> {
  whereClause:
    | ClauseFromExpression<ExpressionBase<DataTypeBoolean>>
    | undefined;
  entities: ReadonlyArray<TargetBase<S>>;
  groupByClause: ReadonlyArray<ClauseForGroupByList<any>>;
  limit?: number;
  select: SelectionArray;
  isExplicitSelect: boolean;
  conditions: ConditionParams | undefined;
  orderBy: ClauseForOrderByList | undefined;
  throwsIfEmpty?: boolean | (() => Error);
  queryName: string | undefined;
}

/**
 * Query builder params where keys of all types are allowed, but you can specify
 * which ones need to be more type specific
 */
export type GenericQueryBuilderParams<
  S extends BaseDbDiscriminator,
  Req extends {
    [Key in keyof QueryBuilderParams<S>]?:
      | QueryBuilderParams<S>[Key]
      | 'required';
  } = {
    [Key in keyof QueryBuilderParams<S>]: any;
  },
> = {
  [Key in keyof QueryBuilderParams<S>]: Key extends keyof Req
    ? Req[Key] extends 'required'
      ? NonNullable<QueryBuilderParams<S>[Key]>
      : Req[Key]
    : any;
} extends infer U extends QueryBuilderParams<S>
  ? U
  : never;

/**
 * The array tracked inside of the QueryBuilderParams
 */
export type SelectionArray = ReadonlyArray<SelectionArrayItem>;
export type SelectionArrayItem = ClauseForSelectListItem<
  ExpressionBase<any>,
  string | undefined
>;

/**
 * Setter to update and return new query builder params
 */
export type SetQbParams<
  Params extends QueryBuilderParams<S>,
  Update extends Partial<QueryBuilderParams<S>>,
  S extends BaseDbDiscriminator,
> = IsAny<Params> extends true
  ? Params
  : Omit<Params, keyof Update> & Update extends infer U extends
        QueryBuilderParams<S>
    ? Expand<U>
    : never;

export function updateQueryBuilderParams<
  Params extends QueryBuilderParams<S>,
  Update extends Partial<QueryBuilderParams<S>>,
  S extends BaseDbDiscriminator,
>(params: Params, update: Update): SetQbParams<Params, Update, S> {
  return {
    ...params,
    ...update,
  } as any;
}

export type CanWhere<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    IsAny<Params>,
    IsAny<Params['whereClause']>,
    AllOf<
      [
        undefined extends Params['whereClause'] ? true : false,
        CanGroupBy<Params, S>,
        CanLimit<Params, S>,
      ]
    >,
  ]
>;

export type CanLogicalFilterClause<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    IsAny<Params>,
    AllOf<
      [
        undefined extends Params['whereClause'] ? false : true,
        CanGroupBy<Params, S>,
        CanLimit<Params, S>,
      ]
    >,
  ]
>;

export type CanJoin<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    IsAny<Params>,
    AllOf<
      [
        undefined extends Params['whereClause'] ? true : false,
        CanWhere<Params, S>,
        CanGroupBy<Params, S>,
        CanLimit<Params, S>,
        CanSelect<Params, S>,
      ]
    >,
  ]
>;

export type CanGroupBy<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    IsAny<Params>,
    IsAny<Params['groupByClause']>,
    AllOf<
      [Params['groupByClause'] extends [] ? true : false, CanLimit<Params, S>]
    >,
  ]
>;

export type CanLimit<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    IsAny<Params>,
    IsAny<Params['limit']>,
    AllOf<[undefined extends Params['limit'] ? true : false]>,
  ]
>;

export type CanSelect<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    IsAny<Params['select']>,
    AllOf<
      [
        Params['isExplicitSelect'] extends true ? false : true,
        CanOrderBy<Params, S>,
        CanLimit<Params, S>,
      ]
    >,
  ]
>;

export type CanOrderBy<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [IsAny<Params['orderBy']>, undefined extends Params['orderBy'] ? true : false]
>;
