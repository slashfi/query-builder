import type { GenericAny, TypecheckError } from '@/core-utils';
import type { BaseDbDiscriminator } from '../Base';
import type { ExpressionBuilder } from '../ExpressionBuilder';
import { createExpressionBuilder } from '../expression-builder';
import {
  type ExpressionAggregateDataDistribution,
  expressionDataDistributionFn,
  type ValidDataTypesForAggregateDataDistribution,
} from '../expressions/ExpressionFnDataDistribution';

export const max: DataDistributionFn<'max'> = (builder) => {
  const b = createExpressionBuilder(
    expressionDataDistributionFn.create(builder._expression, 'max')
  );

  return b as GenericAny;
};

export const min: DataDistributionFn<'min'> = (builder) => {
  const b = createExpressionBuilder(
    expressionDataDistributionFn.create(builder._expression, 'min')
  );

  return b as GenericAny;
};

export const avg: DataDistributionFn<'avg'> = (builder) => {
  const b = createExpressionBuilder(
    expressionDataDistributionFn.create(builder._expression, 'avg')
  );

  return b as GenericAny;
};

export type DataDistributionFn<Option extends 'min' | 'max' | 'avg'> = <
  Builder extends ExpressionBuilder<GenericAny, S>,
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
