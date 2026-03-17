import type { GenericAny } from '@/core-utils';
import type { BaseDbDiscriminator, ExpressionBase } from './Base';
import type { ConstantBase } from './constants/base';
import { constantForArray } from './constants/ConstantForArray';
import { constantForBoolean } from './constants/ConstantForBoolean';
import { constantForDecimal } from './constants/ConstantForDecimal';
import { constantForFloat } from './constants/ConstantForFloat';
import { constantForInteger } from './constants/ConstantForInteger';
import { constantForJson } from './constants/ConstantForJson';
import { constantForTimestamp } from './constants/ConstantForTimestamp';
import { constantForVarchar } from './constants/ConstantForVarchar';
import {
  type DataTypeBoolean,
  type DataTypes,
  type DataTypeUnion,
  getNonNullableDataType,
} from './DataType';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
  SelectorForJson,
} from './ExpressionBuilder';
import { expressionBracket } from './expressions/ExpressionBracket';
import { expressionJsonPropertyAccess } from './expressions/ExpressionJsonPropertyAccess';
import { expressionLeftRightBinary } from './expressions/ExpressionLeftRightBinary';
import { expressionRightUnaryBinary } from './expressions/ExpressionRightUnaryBinary';
import { expressionSubqueryBinary } from './expressions/ExpressionSubqueryBinary';
import { operatorBinaryArrayContains } from './operators/OperatorBinaryArrayContains';
import { operatorBinaryComparator } from './operators/OperatorBinaryComparator';
import { operatorBinaryJsonbContains } from './operators/OperatorBinaryJsonbContains';
import { operatorBinaryLogical } from './operators/OperatorBinaryLogical';
import { operatorBinarySimilarity } from './operators/OperatorBinarySimilarity';
import { operatorUnaryIs } from './operators/OperatorUnaryIs';

const expressionBuilderShapeSymbol = Symbol('expressionBuilderShape');

export type MakeExpressionBuilderShape<
  T extends Pick<
    ExpressionBuilderShape<GenericAny>,
    '_expression'
  > = ExpressionBuilderShape<ExpressionBase<GenericAny>>,
> = T & {
  $type: typeof expressionBuilderShapeSymbol;
};

export function makeExpressionBuilderShape<
  Expr extends ExpressionBase<GenericAny>,
  Shape extends Pick<ExpressionBuilderShape<Expr>, '_expression'>,
>(expr: Shape): ExpressionBuilderShape<Expr> {
  return {
    ...expr,
    $type: expressionBuilderShapeSymbol,
  };
}

export function isExpressionBuilderShape(
  value: GenericAny
): value is ExpressionBuilderShape<ExpressionBase<GenericAny>> {
  return (
    typeof value === 'object' &&
    !!value.$type &&
    value.$type === expressionBuilderShapeSymbol
  );
}

export function createExpressionBuilder<
  Expr extends ExpressionBase<GenericAny>,
  S extends BaseDbDiscriminator,
>(leftExpr: Expr): ExpressionBuilder<Expr, S> {
  const expressionBuilder: ExpressionBuilder<GenericAny, S> = {
    _expression: leftExpr,
    $type: expressionBuilderShapeSymbol,
    asc() {
      return {
        expression: leftExpr,
        direction: 'asc',
      };
    },
    desc() {
      return {
        expression: leftExpr,
        direction: 'desc',
      };
    },
    as(alias) {
      return [createExpressionBuilder(leftExpr), alias] as const;
    },
    and: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr: expressionBracket.create(leftExpr),
          operator: operatorBinaryLogical.create('AND'),
          rightExpr: expressionBracket.create(
            exprOrConstant(targetExpr, leftExpr.dataType)
          ),
        })
      );
    },
    or: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryLogical.create('OR'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    notEquals: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('!='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    equals: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    in: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionSubqueryBinary.create({
          leftExpr,
          comparator: 'IN',
          qb: targetExpr,
        })
      );
    },
    notIn: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionSubqueryBinary.create({
          leftExpr,
          comparator: 'NOT IN',
          qb: targetExpr,
        })
      );
    },
    moreThan: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('>'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    moreThanOrEquals: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('>='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    lessThan: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('<'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    lessThanOrEquals: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('<='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    like: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinarySimilarity.create('LIKE'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    ilike: (targetExpr) => {
      return createExpressionBuilder<GenericAny, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinarySimilarity.create('ILIKE'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    isNull() {
      return createExpressionBuilder<GenericAny, S>(
        expressionRightUnaryBinary.create({
          leftExpr,
          rightUnaryOp: operatorUnaryIs.create('NULL'),
        }) as ExpressionBase<DataTypeBoolean>
      );
    },
    isNotNull() {
      return createExpressionBuilder(
        expressionRightUnaryBinary.create({
          leftExpr,
          rightUnaryOp: operatorUnaryIs.create('NULL', {
            isNegated: true,
          }),
        }) as ExpressionBase<DataTypeBoolean>
      );
    },
    contains: (targetExpr: GenericAny) => {
      const nonNullableDataType = getNonNullableDataType(leftExpr.dataType);
      const isArrayType =
        nonNullableDataType?.class === 'data_type' &&
        nonNullableDataType.type === 'array';
      const isJsonType =
        nonNullableDataType?.class === 'data_type' &&
        nonNullableDataType.type === 'json';

      if (isArrayType) {
        return createExpressionBuilder<GenericAny, S>(
          expressionLeftRightBinary.create({
            leftExpr,
            operator: operatorBinaryArrayContains.create(),
            rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
          })
        );
      } else if (isJsonType) {
        return createExpressionBuilder<GenericAny, S>(
          expressionLeftRightBinary.create({
            leftExpr,
            operator: operatorBinaryJsonbContains.create(),
            rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
          })
        );
      } else {
        throw new Error(
          `Contains operator not supported for data type: ${leftExpr.dataType.type}`
        );
      }
    },
    accessJsonPath: (fn) => {
      const res = fn(createJsonProxy());
      const { path } = res();
      return createExpressionBuilder(
        expressionJsonPropertyAccess.create(leftExpr, path, false) as GenericAny
      );
    },
    accessStringPath: (fn) => {
      const res = fn(createJsonProxy());
      const { path } = res();
      return createExpressionBuilder(
        expressionJsonPropertyAccess.create(leftExpr, path, true) as GenericAny
      );
    },
  };

  return expressionBuilder as unknown as ExpressionBuilder<Expr, S>;
}

export function createJsonProxy<
  S extends BaseDbDiscriminator,
>(): SelectorForJson<GenericAny, S> {
  function getNewProxy(path: string[] = []) {
    const baseFn = () => ({ path });
    return new Proxy(baseFn, {
      get: (_target, prop) => {
        return getNewProxy([...path, String(prop)]);
      },
    });
  }

  return getNewProxy() as SelectorForJson<GenericAny, S>;
}

/**
 * If the target Expr is an expression, it will return it. Otherwise,
 * it will return a constant of the value.
 */
export function exprOrConstant<S extends BaseDbDiscriminator>(
  targetExpr: ExpressionBuilder<GenericAny, S> | GenericAny,
  desiredDataType: DataTypes
): GenericAny {
  return isExpressionBuilder(targetExpr)
    ? targetExpr._expression
    : (dataTypeToConstant(desiredDataType, targetExpr) as GenericAny);
}

export function isExpressionBuilder<S extends BaseDbDiscriminator>(
  value: ExpressionBuilder<GenericAny, S> | GenericAny
): value is ExpressionBuilder<ExpressionBase<GenericAny>, S> {
  return (
    !!value &&
    typeof value === 'object' &&
    !!value._expression &&
    typeof value._expression === 'object' &&
    typeof value._expression.type === 'string' &&
    typeof value._expression.variant === 'string' &&
    typeof value._expression.class === 'string'
  );
}

export function dataTypeToConstant<DataType extends DataTypes>(
  dataType: DataType,
  value: GenericAny
): ConstantBase<GenericAny> {
  const finalDataType = (() => {
    return getNonNullableDataType(dataType);
  })() as Exclude<DataType, DataTypeUnion<GenericAny>>;

  if (!finalDataType) {
    throw new Error(`Data type of ${dataType.type} is not supported`);
  }

  switch (finalDataType.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to boolean constant`
        );
      }
      return constantForBoolean.create(value) as GenericAny;
    case 'int':
      if (typeof value !== 'number') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to int constant`
        );
      }

      return constantForInteger.create(value) as GenericAny;
    case 'float':
      if (typeof value !== 'number') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to float constant`
        );
      }

      return constantForFloat.create(value) as GenericAny;
    case 'decimal':
      if (typeof value !== 'string') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to decimal constant`
        );
      }

      return constantForDecimal.create(value) as GenericAny;

    case 'varchar':
      if (typeof value !== 'string') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to varchar constant`
        );
      }
      return constantForVarchar.create(value) as GenericAny;
    case 'array': {
      if (typeof value !== 'object' || !Array.isArray(value)) {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to array constant`
        );
      }

      const itemDataType = finalDataType.primitiveDataType as DataTypes;

      if (
        itemDataType.type === 'tabular_columns' ||
        itemDataType.type === 'tuple'
      ) {
        throw new Error(`Can't create array of tabular columns`);
      }
      return constantForArray.create(
        itemDataType,
        value.map(
          (item) => dataTypeToConstant(itemDataType, item) as GenericAny
        )
      ) as GenericAny;
    }
    case 'json':
      return constantForJson.create(value) as GenericAny;
    case 'timestamp':
      if (value instanceof Date) {
        return constantForTimestamp.create(value) as GenericAny;
      }

      throw new Error(
        `Couldn't convert value of type ${typeof value} to Timestamp const`
      );
    case 'tabular_columns':
      throw new Error(
        'Data type to constant is not implemented for tabular_columns'
      );
    case 'tuple':
      throw new Error('Data type to constant is not implemented for tuples');
    default:
      throw new Error(
        `Data type to constant is not implemented for ${dataType.type}`
      );
  }
}
