import type { TypecheckError } from '@/core-utils';
import type { BaseDbDiscriminator } from '../base';
import { createExpressionBuilder } from '../expression-builder';
import type { ExpressionBuilder } from '../expression-builder-type';
import {
  type ExpressionAggregateDataDistribution,
  type ValidDataTypesForAggregateDataDistribution,
  expressionDataDistributionFn,
} from '../expressions/expression-fn-data-distribution';

export const max: DataDistributionFn<'max'> = (builder) => {
  const b = createExpressionBuilder(
    expressionDataDistributionFn.create(builder._expression, 'max')
  );

  return b as any;
};

export const min: DataDistributionFn<'min'> = (builder) => {
  const b = createExpressionBuilder(
    expressionDataDistributionFn.create(builder._expression, 'min')
  );

  return b as any;
};

export const avg: DataDistributionFn<'avg'> = (builder) => {
  const b = createExpressionBuilder(
    expressionDataDistributionFn.create(builder._expression, 'avg')
  );

  return b as any;
};

export type DataDistributionFn<Option extends 'min' | 'max' | 'avg'> = <
  Builder extends ExpressionBuilder<any, S>,
  S extends BaseDbDiscriminator,
>(
  builder: Builder
) => Builder extends ExpressionBuilder<infer J, S>
  ? J['dataType']['type'] extends ValidDataTypesForAggregateDataDistribution['type']
    ? ExpressionBuilder<ExpressionAggregateDataDistribution<J, Option>, S>
    : TypecheckError<
        `Can't compute ${Uppercase<Option>} on "type" ${J['dataType']['type']}`,
        {
          expression: J;
        }
      >
  : never;
