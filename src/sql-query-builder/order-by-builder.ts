import type { GenericAny } from '../core-utils';
import type { BaseDbDiscriminator } from '../Base';
import {
  clauseForOrderByList,
  type OrderByListItem,
} from '../clauses/ClauseForOrderBy';
import type { ExpressionBuilder } from '../ExpressionBuilder';
import {
  type QueryBuilderParams,
  type SetQbParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './SqlQueryBuilder';

export const createSqlQueryBuilderOrderBy = <S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>
): SqlQueryBuilderOrderBy<GenericAny, S> => {
  return (...orderByList) => {
    return createSqlQueryBuilder(
      updateQueryBuilderParams(params, {
        orderBy: clauseForOrderByList.create(
          orderByList.map((item) =>
            '_expression' in item
              ? { expression: item._expression, direction: 'asc' }
              : item
          )
        ),
      })
    );
  };
};

/**
 * The type of the parameter passed when calling "orderBy"
 */
export type BuildOrderByParameterItem<S extends BaseDbDiscriminator> =
  | ExpressionBuilder<GenericAny, S>
  | OrderByListItem;

/**
 * The final ordering of the list
 */
export type ToOrderByList<
  T extends ReadonlyArray<BuildOrderByParameterItem<S>>,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof T]: T[Key] extends ExpressionBuilder<GenericAny, S>
    ? { expression: T[Key]['_expression']; direction: 'desc' }
    : T[Key] extends OrderByListItem
      ? T[Key]
      : never;
};

export type SqlQueryBuilderOrderBy<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = <
  const Values extends ReadonlyArray<
    ExpressionBuilder<GenericAny, S> | OrderByListItem
  >,
>(
  ...values: Values
) => AssertSqlQueryBuilder<
  SetQbParams<
    Params,
    {
      select: {
        [Key in keyof Values]: Values[Key] extends ExpressionBuilder<
          GenericAny,
          S
        >
          ? { expression: Values[Key]['_expression']; direction: 'desc' }
          : Values[Key] extends OrderByListItem
            ? Values[Key]
            : never;
      };
      isExplicitSelect: true;
    },
    S
  >,
  S
>;
