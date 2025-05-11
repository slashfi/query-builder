import type { BaseDbDiscriminator } from '../Base';
import type { ExpressionBuilder } from '../ExpressionBuilder';
import {
  type QueryBuilderParams,
  type SetQbParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import {
  type OrderByListItem,
  clauseForOrderByList,
} from '../clauses/ClauseForOrderBy';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './SqlQueryBuilder';

export const createSqlQueryBuilderOrderBy = <S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>
): SqlQueryBuilderOrderBy<any, S> => {
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
  | ExpressionBuilder<any, S>
  | OrderByListItem;

/**
 * The final ordering of the list
 */
export type ToOrderByList<
  T extends ReadonlyArray<BuildOrderByParameterItem<S>>,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof T]: T[Key] extends ExpressionBuilder<any, S>
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
    ExpressionBuilder<any, S> | OrderByListItem
  >,
>(
  ...values: Values
) => AssertSqlQueryBuilder<
  SetQbParams<
    Params,
    {
      select: {
        [Key in keyof Values]: Values[Key] extends ExpressionBuilder<any, S>
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
