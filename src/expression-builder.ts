import type { BaseDbDiscriminator, ExpressionBase } from './Base';
import {
  type DataTypeBoolean,
  type DataTypeUnion,
  type DataTypes,
  getNonNullableDataType,
} from './DataType';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
  SelectorForJson,
} from './ExpressionBuilder';
import { constantForArray } from './constants/ConstantForArray';
import { constantForBoolean } from './constants/ConstantForBoolean';
import { constantForFloat } from './constants/ConstantForFloat';
import { constantForInteger } from './constants/ConstantForInteger';
import { constantForJson } from './constants/ConstantForJson';
import { constantForTimestamp } from './constants/ConstantForTimestamp';
import { constantForVarchar } from './constants/ConstantForVarchar';
import type { ConstantBase } from './constants/base';
import { expressionBracket } from './expressions/ExpressionBracket';
import { expressionJsonPropertyAccess } from './expressions/ExpressionJsonPropertyAccess';
import { expressionLeftRightBinary } from './expressions/ExpressionLeftRightBinary';
import { expressionRightUnaryBinary } from './expressions/ExpressionRightUnaryBinary';
import { expressionSubqueryBinary } from './expressions/ExpressionSubqueryBinary';
import { operatorBinaryComparator } from './operators/OperatorBinaryComparator';
import { operatorBinaryLogical } from './operators/OperatorBinaryLogical';
import { operatorBinarySimilarity } from './operators/OperatorBinarySimilarity';
import { operatorUnaryIs } from './operators/OperatorUnaryIs';

const expressionBuilderShapeSymbol = Symbol('expressionBuilderShape');

export type MakeExpressionBuilderShape<
  T extends Pick<
    ExpressionBuilderShape<any>,
    '_expression'
  > = ExpressionBuilderShape<ExpressionBase<any>>,
> = T & {
  $type: typeof expressionBuilderShapeSymbol;
};

export function makeExpressionBuilderShape<
  Expr extends ExpressionBase<any>,
  Shape extends Pick<ExpressionBuilderShape<Expr>, '_expression'>,
>(expr: Shape): ExpressionBuilderShape<Expr> {
  return {
    ...expr,
    $type: expressionBuilderShapeSymbol,
  };
}

export function isExpressionBuilderShape(
  value: any
): value is ExpressionBuilderShape<ExpressionBase<any>> {
  return (
    typeof value === 'object' &&
    !!value.$type &&
    value.$type === expressionBuilderShapeSymbol
  );
}

export function createExpressionBuilder<
  Expr extends ExpressionBase<any>,
  S extends BaseDbDiscriminator,
>(leftExpr: Expr): ExpressionBuilder<Expr, S> {
  const expressionBuilder: ExpressionBuilder<any, S> = {
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
      return createExpressionBuilder<any, S>(
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
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryLogical.create('OR'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    notEquals: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('!='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    equals: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    in: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionSubqueryBinary.create({
          leftExpr,
          comparator: 'IN',
          qb: targetExpr,
        })
      );
    },
    notIn: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionSubqueryBinary.create({
          leftExpr,
          comparator: 'NOT IN',
          qb: targetExpr,
        })
      );
    },
    moreThan: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('>'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    moreThanOrEquals: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('>='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    lessThan: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('<'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    lessThanOrEquals: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinaryComparator.create('<='),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    like: (targetExpr) => {
      return createExpressionBuilder<any, S>(
        expressionLeftRightBinary.create({
          leftExpr,
          operator: operatorBinarySimilarity.create('LIKE'),
          rightExpr: exprOrConstant(targetExpr, leftExpr.dataType),
        })
      );
    },
    isNull() {
      return createExpressionBuilder<any, S>(
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
    accessJsonPath: (fn) => {
      const res = fn(createJsonProxy());
      const { path } = res();
      return createExpressionBuilder(
        expressionJsonPropertyAccess.create(leftExpr, path, false) as any
      );
    },
    accessStringPath: (fn) => {
      const res = fn(createJsonProxy());
      const { path } = res();
      return createExpressionBuilder(
        expressionJsonPropertyAccess.create(leftExpr, path, true) as any
      );
    },
  };

  return expressionBuilder as unknown as ExpressionBuilder<Expr, S>;
}

export function createJsonProxy<
  S extends BaseDbDiscriminator,
>(): SelectorForJson<any, S> {
  function getNewProxy(path: string[] = []) {
    const baseFn = () => ({ path });
    return new Proxy(baseFn, {
      get: (_target, prop) => {
        return getNewProxy([...path, String(prop)]);
      },
    });
  }

  return getNewProxy() as SelectorForJson<any, S>;
}

/**
 * If the target Expr is an expression, it will return it. Otherwise,
 * it will return a constant of the value.
 */
export function exprOrConstant<S extends BaseDbDiscriminator>(
  targetExpr: ExpressionBuilder<any, S> | any,
  desiredDataType: DataTypes
): any {
  return isExpressionBuilder(targetExpr)
    ? targetExpr._expression
    : (dataTypeToConstant(desiredDataType, targetExpr) as any);
}

export function isExpressionBuilder<S extends BaseDbDiscriminator>(
  value: ExpressionBuilder<any, S> | any
): value is ExpressionBuilder<ExpressionBase<any>, S> {
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
  value: any
): ConstantBase<any> {
  const finalDataType = (() => {
    return getNonNullableDataType(dataType);
  })() as Exclude<DataType, DataTypeUnion<any>>;

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
      return constantForBoolean.create(value) as any;
    case 'int':
      if (typeof value !== 'number') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to int constant`
        );
      }

      return constantForInteger.create(value) as any;
    case 'float':
      if (typeof value !== 'number') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to float constant`
        );
      }

      return constantForFloat.create(value) as any;
    case 'varchar':
      if (typeof value !== 'string') {
        throw new Error(
          `Couldn't convert value of type ${typeof value} to varchar constant`
        );
      }
      return constantForVarchar.create(value) as any;
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
        value.map((item) => dataTypeToConstant(itemDataType, item) as any)
      ) as any;
    }
    case 'json':
      return constantForJson.create(value) as any;
    case 'timestamp':
      if (value instanceof Date) {
        return constantForTimestamp.create(value) as any;
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
