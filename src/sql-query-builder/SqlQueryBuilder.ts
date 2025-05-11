import type { AnyOf, IsAny } from '@/core-utils';
import type { BaseDbDiscriminator } from '../Base';
import {
  type CanGroupBy,
  type CanLimit,
  type CanLogicalFilterClause,
  type CanOrderBy,
  type CanSelect,
  type CanWhere,
  type QueryBuilderParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import { clauseFromExpression } from '../clauses/ClauseFromExpression';
import {
  type OperatorBinaryLogical,
  operatorBinaryLogical,
} from '../operators/OperatorBinaryLogical';
import {
  type SqlQueryBuilderGroupBy,
  createSqlQueryBuilderGroupBy,
} from './group-by-list-builder';
import {
  type SqlQueryBuilderLimit,
  createSqlQueryBuilderLimit,
} from './limit-builder';
import {
  type SqlQueryBuilderLogicalFilterClause,
  createSqlQueryBuilderLogicalFilterClause,
} from './logical-filter-clause-builder';
import {
  type SqlQueryBuilderOrderBy,
  createSqlQueryBuilderOrderBy,
} from './order-by-builder';
import {
  type SqlQueryBuilderSelect,
  createSqlQueryBuilderSelect,
} from './select-list-builder';
import type { SqlQueryBuilderWhere } from './where-builder';

/**
 * A builder that exposes a function for
 */
export interface SqlQueryBuilder<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> {
  _debug(): Params;
  where: AnyOf<[IsAny<Params>, CanWhere<Params, S>]> extends true
    ? SqlQueryBuilderWhere<Params, S>
    : never;
  and: AnyOf<[IsAny<Params>, CanLogicalFilterClause<Params, S>]> extends true
    ? SqlQueryBuilderLogicalFilterClause<
        Params,
        OperatorBinaryLogical<'AND'>,
        S
      >
    : never;
  or: AnyOf<[IsAny<Params>, CanLogicalFilterClause<Params, S>]> extends true
    ? SqlQueryBuilderLogicalFilterClause<Params, OperatorBinaryLogical<'OR'>, S>
    : never;
  groupBy: AnyOf<[IsAny<Params>, CanGroupBy<Params, S>]> extends true
    ? SqlQueryBuilderGroupBy<Params, S>
    : never;
  limit: AnyOf<[IsAny<Params>, CanLimit<Params, S>]> extends true
    ? SqlQueryBuilderLimit<Params, S>
    : never;
  select: AnyOf<[CanSelect<Params, S>, IsAny<Params>]> extends true
    ? SqlQueryBuilderSelect<Params, S>
    : never;
  orderBy: AnyOf<[CanOrderBy<Params, S>, IsAny<Params>]> extends true
    ? SqlQueryBuilderOrderBy<Params, S>
    : never;

  asSubquery: () => Params;
}

export function createSqlQueryBuilder<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>
): SqlQueryBuilder<any, S> {
  const builder: SqlQueryBuilder<any, S> = {
    _debug: () => params,
    asSubquery: () => params,
    where: (booleanExprBuilder) => {
      return createSqlQueryBuilder(
        updateQueryBuilderParams(params, {
          whereClause: clauseFromExpression.create(
            booleanExprBuilder._expression
          ),
        })
      );
    },
    and: createSqlQueryBuilderLogicalFilterClause(
      params,
      operatorBinaryLogical.create('AND')
    ),
    or: createSqlQueryBuilderLogicalFilterClause(
      params,
      operatorBinaryLogical.create('OR')
    ),
    groupBy: createSqlQueryBuilderGroupBy(params),
    limit: createSqlQueryBuilderLimit(params),
    select: createSqlQueryBuilderSelect(params),
    orderBy: createSqlQueryBuilderOrderBy(params),
  };

  return builder;
}
