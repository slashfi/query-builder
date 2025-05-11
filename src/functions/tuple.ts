import type {
  BaseDbDiscriminator,
  DataTypeBase,
  ExpressionBase,
} from '../Base';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
} from '../ExpressionBuilder';
import { createExpressionBuilder } from '../expression-builder';
import {
  type ExpressionTuple,
  expressionTuple,
} from '../expressions/ExpressionTuple';

export const tuple: Tuple = (...builders) => {
  const b = createExpressionBuilder(
    expressionTuple.create(builders.map((val) => val._expression))
  );

  return b as any;
};

export type Tuple = <
  const Builders extends ReadonlyArray<ExpressionBuilderShape<any>>,
  S extends BaseDbDiscriminator,
>(
  ...builder: Builders
) => ExpressionBuilder<
  ExpressionTuple<{
    [Key in keyof Builders]: Builders[Key] extends ExpressionBuilder<
      infer J extends ExpressionBase<DataTypeBase>,
      S
    >
      ? J
      : never;
  }>,
  S
>;
