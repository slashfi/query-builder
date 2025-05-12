import {
  type QueryBuilderParams,
  type SetQbParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import type { BaseDbDiscriminator, ExpressionBase } from '../base';
import {
  type ClauseFromExpression,
  clauseFromExpression,
} from '../clauses/clause-from-expression';
import type { DataTypeBoolean } from '../data-type';
import type { ExpressionBuilderShape } from '../expression-builder-type';
import type { SuppressLongWhereClause } from '../global';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './sql-query-builder';

export function createSqlQueryBuilderWhere<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>
): SqlQueryBuilderWhere<any, S> {
  return (filterClauseBuilder) => {
    return createSqlQueryBuilder(
      updateQueryBuilderParams(params, {
        whereClause: clauseFromExpression.create(
          filterClauseBuilder._expression
        ),
      })
    );
  };
}

export type SqlQueryBuilderWhere<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = <T extends ExpressionBase<DataTypeBoolean>>(
  clause: ExpressionBuilderShape<T>
) => AssertSqlQueryBuilder<
  SetQbParams<
    Params,
    {
      whereClause: SuppressLongWhereClause extends true
        ? ClauseFromExpression<ExpressionBase<DataTypeBoolean>>
        : ClauseFromExpression<T>;
    },
    S
  >,
  S
>;
