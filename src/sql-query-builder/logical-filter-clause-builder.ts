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
import {
  type ExpressionLeftRightBinary,
  expressionLeftRightBinary,
} from '../expressions/expression-left-right-binary';
import type { SuppressLongWhereClause } from '../global';
import type { OperatorBinaryLogical } from '../operators/operator-binary-logical';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './sql-query-builder';

export function createSqlQueryBuilderLogicalFilterClause<
  Op extends OperatorBinaryLogical<'AND'> | OperatorBinaryLogical<'OR'>,
  S extends BaseDbDiscriminator,
>(
  params: QueryBuilderParams<S>,
  op: Op
): SqlQueryBuilderLogicalFilterClause<any, Op, S> {
  return (booleanExprBuilder) => {
    return createSqlQueryBuilder(
      updateQueryBuilderParams(params, {
        whereClause: params.whereClause
          ? clauseFromExpression.create(
              expressionLeftRightBinary.create({
                leftExpr: params.whereClause.expr,
                operator: op,
                rightExpr: booleanExprBuilder._expression,
              })
            )
          : clauseFromExpression.create(booleanExprBuilder._expression),
      })
    );
  };
}

export type SqlQueryBuilderLogicalFilterClause<
  Params extends QueryBuilderParams<S>,
  Op extends OperatorBinaryLogical<'AND'> | OperatorBinaryLogical<'OR'>,
  S extends BaseDbDiscriminator,
> = <T extends ExpressionBase<DataTypeBoolean>>(
  clause: ExpressionBuilderShape<T>
) => AssertSqlQueryBuilder<
  SuppressLongWhereClause extends true
    ? Params
    : SetQbParams<
        Params,
        {
          whereClause: SuppressLongWhereClause extends true
            ? ClauseFromExpression<ExpressionBase<DataTypeBoolean>>
            : undefined extends Params['whereClause']
              ? ClauseFromExpression<T>
              : ClauseFromExpression<
                  ExpressionLeftRightBinary<
                    NonNullable<Params['whereClause']>['expr'],
                    Op,
                    T
                  >
                >;
        },
        S
      >,
  S
>;
