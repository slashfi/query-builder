import type { BaseDbDiscriminator, ExpressionBase } from '../Base';
import type { DataTypeBoolean } from '../DataType';
import type { ExpressionBuilderShape } from '../ExpressionBuilder';
import {
  type QueryBuilderParams,
  type SetQbParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import {
  type ClauseFromExpression,
  clauseFromExpression,
} from '../clauses/ClauseFromExpression';
import {
  type ExpressionLeftRightBinary,
  expressionLeftRightBinary,
} from '../expressions/ExpressionLeftRightBinary';
import type { SuppressLongWhereClause } from '../global';
import type { OperatorBinaryLogical } from '../operators/OperatorBinaryLogical';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './SqlQueryBuilder';

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
