import type { TypecheckError } from '@/core-utils';
import type {
  BaseDbDiscriminator,
  DataTypeBase,
  ExpressionBase,
} from '../Base';
import type { GetNonNullableDataType, MakeDataTypeNullable } from '../DataType';
import type { ExpressionBuilder } from '../ExpressionBuilder';
import { createExpressionBuilder } from '../expression-builder';
import {
  type ExpressionAggregateSum,
  type ValidDataTypesForAggregateSum,
  expressionSum,
} from '../expressions/ExpressionFnSum';

export const sum: Sum = (builder) => {
  const b = createExpressionBuilder(expressionSum.create(builder._expression));

  return b as any;
};

export type Sum = <
  Builder extends ExpressionBuilder<any, S>,
  S extends BaseDbDiscriminator,
>(
  builder: Builder
) => Builder extends ExpressionBuilder<
  infer J extends ExpressionBase<DataTypeBase>,
  S
>
  ? GetNonNullableDataType<J['dataType']> extends infer Dt extends
      ValidDataTypesForAggregateSum
    ? ExpressionBuilder<
        ExpressionAggregateSum<ExpressionBase<MakeDataTypeNullable<Dt>>>,
        S
      >
    : TypecheckError<
        `Can't compute SUM on "type" ${J['dataType']['type']}`,
        {
          expression: J;
        }
      >
  : never;
