import type { TypecheckError } from '@/core-utils';
import type { BaseDbDiscriminator, DataTypeBase } from '../base';
import { createExpressionBuilder } from '../expression-builder';
import type { ExpressionBuilder } from '../expression-builder-type';
import {
  type ExpressionAggregateCount,
  expressionCount,
} from '../expressions/expression-fn-count';

export const count: Count = (builder) => {
  const b = createExpressionBuilder(
    expressionCount.create(builder._expression)
  );

  return b as any;
};

export type Count = <
  Builder extends ExpressionBuilder<any, S>,
  S extends BaseDbDiscriminator,
>(
  builder: Builder
) => Builder extends ExpressionBuilder<infer J, S>
  ? J['dataType'] extends DataTypeBase
    ? ExpressionBuilder<ExpressionAggregateCount<J>, S>
    : TypecheckError<
        `Can't compute COUNT on "type" ${J['dataType']['type']}`,
        {
          expression: J;
        }
      >
  : never;
