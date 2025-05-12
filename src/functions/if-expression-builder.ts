import type { TypecheckError } from '@/core-utils';
import type { BaseDbDiscriminator, ExpressionBase } from '../base';
import type { DataTypeBoolean } from '../data-type';
import { createExpressionBuilder } from '../expression-builder';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
} from '../expression-builder-type';
import { type ExpressionIf, expressionIf } from '../expressions/expression-if';

export const ifClause: IfClause = (conditionExpr, options) => {
  const b = createExpressionBuilder(
    expressionIf.create(
      conditionExpr._expression,
      options.ifTrue._expression,
      options.ifFalse._expression
    )
  );

  return b as any;
};

type IfClause = <
  ConditionClauseBuilder extends ExpressionBuilderShape<any>,
  TrueExprBuilder extends ExpressionBuilderShape<any>,
  FalseExprBuilder extends ExpressionBuilderShape<any>,
  S extends BaseDbDiscriminator,
>(
  conditionExpr: ConditionClauseBuilder,
  options: {
    ifTrue: TrueExprBuilder;
    ifFalse: FalseExprBuilder;
  }
) => ConditionClauseBuilder extends ExpressionBuilderShape<infer ConditionExpr>
  ? ConditionExpr['dataType'] extends DataTypeBoolean
    ? TrueExprBuilder extends ExpressionBuilderShape<
        infer TrueExpr extends ExpressionBase<infer TrueDataType>
      >
      ? FalseExprBuilder extends ExpressionBuilderShape<
          infer FalseExpr extends ExpressionBase<infer FalseDataType>
        >
        ? FalseDataType extends TrueDataType
          ? ExpressionBuilder<
              ExpressionIf<
                ConditionExpr,
                TrueExpr,
                FalseExpr extends ExpressionBase<TrueDataType>
                  ? FalseExpr
                  : never
              >,
              S
            >
          : TypecheckError<
              'The data types of the TRUE and FALSE expressions must be the same.',
              {
                trueDataType: TrueDataType;
                falseDataType: FalseDataType;
              }
            >
        : never
      : never
    : TypecheckError<
        `The first condition of an IF clause must a boolean, but instead received type ${ConditionExpr['dataType']['type']}`,
        {
          dataType: ConditionExpr['dataType'];
          expression: ConditionExpr;
        }
      >
  : never;
