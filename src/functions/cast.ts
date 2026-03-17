import { assertUnreachable, type GenericAny } from '@/core-utils';
import type { BaseDbDiscriminator, ExpressionBase } from '../Base';
import {
  createDataTypeBoolean,
  createDataTypeDecimal,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeNull,
  createDataTypeTimestamp,
  createDataTypeUnion,
  createDataTypeVarchar,
  type DataTypeBoolean,
  type DataTypeDecimal,
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeTimestamp,
  type DataTypeVarchar,
  isDataTypeNullable,
} from '../DataType';

import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
} from '../ExpressionBuilder';
import { createExpressionBuilder } from '../expression-builder';
import { expressionCast } from '../expressions/ExpressionCast';
import type { GetDataTypesForTs } from '../table-from-schema-column-builder';

export const cast: CastValue = (expr, toType) => {
  const isDtNullable = isDataTypeNullable(expr._expression.dataType);

  const castedDt = (() => {
    switch (toType) {
      case 'varchar':
        return createDataTypeVarchar();
      case 'int':
        return createDataTypeInteger();
      case 'float':
        return createDataTypeFloat();
      case 'timestamp':
        return createDataTypeTimestamp();
      case 'boolean':
        return createDataTypeBoolean();
      case 'decimal':
        return createDataTypeDecimal();
      default:
        return assertUnreachable(toType);
    }
  })();

  return createExpressionBuilder(
    expressionCast.create(
      expr._expression,
      isDtNullable
        ? createDataTypeUnion([castedDt, createDataTypeNull()])
        : castedDt
    )
  ) as ExpressionBuilder<GenericAny, BaseDbDiscriminator>;
};

type CastValue = <
  Base extends ExpressionBuilderShape<ExpressionBase<GenericAny>>,
  ToType extends keyof Dts,
  S extends BaseDbDiscriminator,
>(
  expr: Base,
  toType: ToType
) => ExpressionBuilder<
  ExpressionBase<
    Base['_expression']['dataType']['narrowedType'] extends Dts[ToType]
      ? GetDataTypesForTs<
          Dts[ToType],
          Base['_expression']['dataType']['narrowedType'],
          never
        >
      : Dts[ToType]
  >,
  S
>;

type Dts = {
  varchar: DataTypeVarchar;
  boolean: DataTypeBoolean;
  int: DataTypeInteger;
  float: DataTypeFloat;
  timestamp: DataTypeTimestamp;
  decimal: DataTypeDecimal;
};
