import { assertUnreachable } from '@/core-utils';
import type { BaseDbDiscriminator, ExpressionBase } from '../base';
import {
  type DataTypeBoolean,
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeTimestamp,
  type DataTypeVarchar,
  createDataTypeBoolean,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeNull,
  createDataTypeTimestamp,
  createDataTypeUnion,
  createDataTypeVarchar,
  isDataTypeNullable,
} from '../data-type';

import { createExpressionBuilder } from '../expression-builder';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
} from '../expression-builder-type';
import { expressionCast } from '../expressions/expression-cast';
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
      default:
        throw assertUnreachable(toType);
    }
  })();

  return createExpressionBuilder(
    expressionCast.create(
      expr._expression,
      isDtNullable
        ? createDataTypeUnion([castedDt, createDataTypeNull()])
        : castedDt
    )
  ) as ExpressionBuilder<any, BaseDbDiscriminator>;
};

type CastValue = <
  Base extends ExpressionBuilderShape<ExpressionBase<any>>,
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
};
