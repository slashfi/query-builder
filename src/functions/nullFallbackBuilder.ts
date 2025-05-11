import type { TypecheckError } from '@/core-utils';
import type { BaseDbDiscriminator } from '../Base';
import type {
  DataTypeFromExpression,
  ExpressionBuilder,
  ToExpressionList,
} from '../ExpressionBuilder';
import {
  createExpressionBuilder,
  exprOrConstant,
  isExpressionBuilder,
} from '../expression-builder';
import type { ValidDataTypesForAggregateDataDistribution } from '../expressions/ExpressionFnDataDistribution';
import {
  type ExpressionAggregateNullFallback,
  expressionNullFallback,
} from '../expressions/ExpressionFnNullFallback';

export const coalesce: NullHandlingFn<'coalesce'> = (builder, ...items) => {
  const b = createExpressionBuilder(
    expressionNullFallback.create(
      builder._expression,
      'coalesce',
      items.map((item) => {
        if (isExpressionBuilder(item)) {
          return item._expression;
        }
        return exprOrConstant(item, builder._expression.dataType);
      })
    )
  );

  return b as any;
};

export const ifnull: NullHandlingFn<'ifnull'> = (builder, ...items) => {
  const b = createExpressionBuilder(
    expressionNullFallback.create(
      builder._expression,
      'ifnull',
      items.map((item) => {
        if (isExpressionBuilder(item)) {
          return item._expression;
        }
        return exprOrConstant(item, builder._expression.dataType);
      })
    )
  );

  return b as any;
};
export type NullHandlingFn<Option extends 'coalesce' | 'ifnull'> = <
  Builder extends ExpressionBuilder<any, S>,
  Items extends Option extends 'coalesce'
    ? ReadonlyArray<
        | ExpressionBuilder<any, S>
        | DataTypeFromExpression<Builder['_expression']>['narrowedType']
      >
    : readonly [
        | ExpressionBuilder<any, S>
        | DataTypeFromExpression<Builder['_expression']>['narrowedType'],
      ],
  S extends BaseDbDiscriminator,
>(
  builder: Builder,
  ...items: Items
) => Builder extends ExpressionBuilder<infer J, S>
  ? J['dataType']['type'] extends ValidDataTypesForAggregateDataDistribution['type']
    ? ExpressionBuilder<
        ExpressionAggregateNullFallback<
          J,
          Option,
          ToExpressionList<J['dataType'], Items, S>
        >,
        S
      >
    : TypecheckError<
        `Can't compute ${Uppercase<Option>} on "type" ${J['dataType']['type']}`,
        {
          expression: J;
        }
      >
  : never;
