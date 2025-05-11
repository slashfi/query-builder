import type {
  AnyOf,
  IsAny,
  OriginalReferenceableObject,
  TypecheckError,
} from '@/core-utils';
import type { BaseDbDiscriminator, DataTypeBase, ExpressionBase } from './Base';
import type {
  DataTypeBoolean,
  DataTypeFloat,
  DataTypeInteger,
  DataTypeJson,
  DataTypeNull,
  DataTypeTimestamp,
  DataTypeUnion,
  DataTypeVarchar,
  GetNonNullableDataType,
  IsDataTypeNullable,
  MakeDataTypeNullable,
} from './DataType';
import type { TargetBase } from './FromBuilder';
import type { SelectQueryBuilder } from './QueryBuilder';
import type {
  QueryBuilderParams,
  SelectionArrayItem,
} from './QueryBuilderParams';
import type { OrderByListItem } from './clauses/ClauseForOrderBy';
import type { ExpressionColumn } from './expressions/ExpressionColumn';
import type { ExpressionSelectColumns } from './expressions/ExpressionSelectColumns';
import type { ExpressionSubqueryBinary } from './expressions/ExpressionSubqueryBinary';
import type { OperatorBinaryComparator } from './operators/OperatorBinaryComparator';
import type { OperatorBinaryLogical } from './operators/OperatorBinaryLogical';
import type { OperatoryBinarySimilarity } from './operators/OperatorBinarySimilarity';

export type CompositeSelectionBuilder<
  Base extends TargetBase<S>,
  S extends BaseDbDiscriminator,
> = OriginalReferenceableObject<
  {
    [Column in Extract<
      keyof Base['table']['columnSchema'],
      string
    >]: ExpressionBuilder<ExpressionColumn<Base, Column, S>, S>;
  },
  Base['table']['columnSchema']
> & {
  $columns: {
    (
      all: '*'
    ): ExpressionBuilder<
      ExpressionSelectColumns<Base, keyof Base['table']['columnSchema'], S>,
      S
    >;
    <
      Params extends Partial<
        OriginalReferenceableObject<
          {
            [Column in Extract<
              keyof Base['table']['columnSchema'],
              string
            >]: ExpressionBuilder<ExpressionColumn<Base, Column, S>, S>;
          },
          Base['table']['columnSchema']
        >
      >,
    >(
      params: Params
    ): ExpressionBuilder<
      ExpressionSelectColumns<Base, Extract<keyof Params, string>, S>,
      S
    >;
  };
};

export type SelectorForJson<JsonType, S extends BaseDbDiscriminator> = (() => {
  $dataType: JsonType;
  path: string[];
}) &
  (JsonType extends object
    ? {
        [Key in keyof JsonType]: SelectorForJson<JsonType[Key], S>;
      }
    : {});

type GetJsonbDataType<T extends DataTypeBase> =
  GetNonNullableDataType<T> extends DataTypeJson<infer U> ? U : never;

export interface ExpressionBuilderShape<Expr extends ExpressionBase<any>> {
  $type: symbol;
  _expression: Expr;
}

export interface ExpressionBuilder<
  Expr extends ExpressionBase<any>,
  S extends BaseDbDiscriminator,
> extends ExpressionBuilderShape<Expr> {
  asc(): {
    expression: Expr;
    direction: 'asc';
  } extends infer U extends OrderByListItem
    ? U
    : never;
  desc(): {
    expression: Expr;
    direction: 'desc';
  } extends infer U extends OrderByListItem
    ? U
    : never;
  as<Alias extends string>(
    alias: Alias
  ): readonly [ExpressionBuilder<Expr, S>, Alias];
  equals: SingleBinaryOperatorComparatorApplier<
    Expr,
    OperatorBinaryComparator<'='>,
    S
  >;
  and: SingleBinaryOperatorLogicalApplier<
    Expr,
    OperatorBinaryLogical<'AND'>,
    S
  >;
  or: SingleBinaryOperatorLogicalApplier<Expr, OperatorBinaryLogical<'OR'>, S>;
  notEquals: SingleBinaryOperatorComparatorApplier<
    Expr,
    OperatorBinaryComparator<'!='>,
    S
  >;
  moreThan: SingleBinaryOperatorComparatorApplier<
    Expr,
    OperatorBinaryComparator<'>'>,
    S
  >;
  moreThanOrEquals: SingleBinaryOperatorComparatorApplier<
    Expr,
    OperatorBinaryComparator<'>='>,
    S
  >;
  lessThan: SingleBinaryOperatorComparatorApplier<
    Expr,
    OperatorBinaryComparator<'<'>,
    S
  >;
  lessThanOrEquals: SingleBinaryOperatorComparatorApplier<
    Expr,
    OperatorBinaryComparator<'<='>,
    S
  >;
  like: SingleBinaryOperatorComparatorApplier<
    Expr,
    OperatoryBinarySimilarity<'LIKE', false>,
    S
  >;
  in: InBinaryOperatorApplier<Expr, 'IN', S>;
  notIn: InBinaryOperatorApplier<Expr, 'NOT IN', S>;
  isNull: AnyOf<
    [IsDataTypeNullable<Expr['dataType']>, IsAny<Expr['dataType']>]
  > extends true
    ? () => ExpressionBuilder<ExpressionBase<DataTypeBoolean>, S>
    : TypecheckError<
        `Will always evaluate to FALSE because column is not nullable`,
        {}
      >;
  isNotNull: AnyOf<
    [IsDataTypeNullable<Expr['dataType']>, IsAny<Expr['dataType']>]
  > extends true
    ? () => ExpressionBuilder<ExpressionBase<DataTypeBoolean>, S>
    : TypecheckError<
        `Will always evaluate to TRUE because column is not nullable`,
        {}
      >;
  accessStringPath: AnyOf<
    [
      IsAny<Expr['dataType']>,
      GetNonNullableDataType<Expr['dataType']> extends DataTypeJson<any>
        ? true
        : false,
    ]
  > extends true
    ? <FinalType>(
        fn: (
          obj: SelectorForJson<GetJsonbDataType<Expr['dataType']>, S>
        ) => SelectorForJson<FinalType, S>
      ) => ExpressionBuilder<
        ExpressionBase<
          MakeDataTypeNullable<
            DataTypeVarchar<FinalType extends string ? FinalType : string>
          >
        >,
        S
      >
    : TypecheckError<
        `Can't access JSON path on non-JSON data type`,
        { dataType: Expr['dataType'] }
      >;
  accessJsonPath: AnyOf<
    [
      IsAny<Expr['dataType']>,
      GetNonNullableDataType<Expr['dataType']> extends DataTypeJson<any>
        ? true
        : false,
    ]
  > extends true
    ? <FinalType>(
        fn: (
          obj: SelectorForJson<GetJsonbDataType<Expr['dataType']>, S>
        ) => SelectorForJson<FinalType, S>
      ) => ExpressionBuilder<
        ExpressionBase<
          MakeDataTypeNullable<
            DataTypeJson<
              FinalType extends string ? `"${FinalType}"` : FinalType
            >
          >
        >,
        S
      >
    : TypecheckError<
        `Can't access string path on non-string data type`,
        { dataType: Expr['dataType'] }
      >;
}

type SingleBinaryOperatorComparator<
  Operator extends
    | OperatorBinaryComparator<'!='>
    | OperatorBinaryComparator<'='>
    | OperatorBinaryComparator<'<'>
    | OperatorBinaryComparator<'<='>
    | OperatorBinaryComparator<'>='>
    | OperatorBinaryComparator<'>'>
    | OperatoryBinarySimilarity<'LIKE', true>
    | OperatoryBinarySimilarity<'LIKE', false>,
  DataType extends Operator['supportedDataTypes'][number],
  LeftHandExpr extends ExpressionBase<DataType>,
  S extends BaseDbDiscriminator,
> = <Value extends DataType['narrowedType'] | ExpressionBuilderShape<any>>(
  value: Value
) => IsAny<LeftHandExpr> extends true
  ? ExpressionBuilder<ExpressionBase<DataTypeBoolean>, S>
  : Value extends DataType['narrowedType']
    ? ExpressionBuilder<ExpressionBase<DataTypeBoolean>, S>
    : Value extends ExpressionBuilder<infer U extends ExpressionBase<any>, S>
      ? CanCompareTypes<DataType, U['dataType']> extends true
        ? ExpressionBuilder<ExpressionBase<DataTypeBoolean>, S>
        : TypecheckError<
            `Can't compare type LH type ${DataType['type']} to RH type ${U['dataType']['type']}`,
            {
              rightHandType: U['dataType'];
              leftHandType: DataType;
            }
          >
      : never;

type GetNonNullableType<T extends DataTypeBase> = T extends DataTypeUnion<
  ReadonlyArray<DataTypeBase>
>
  ? Exclude<T['values'][number], DataTypeNull>
  : T;

type CanCompareTypes<
  D1 extends DataTypeBase,
  D2 extends DataTypeBase,
> = GetNonNullableType<D1>['type'] extends infer D1Type extends keyof Matches
  ? GetNonNullableType<D2>['type'] extends Matches[D1Type][number]['type']
    ? true
    : false
  : false;

interface Matches {
  varchar: [DataTypeVarchar];
  int: [DataTypeInteger, DataTypeFloat, DataTypeBoolean, DataTypeTimestamp];
  float: [DataTypeInteger, DataTypeFloat];
  boolean: [DataTypeBoolean, DataTypeInteger, DataTypeFloat];
  timestamp: [DataTypeTimestamp, DataTypeInteger];
}

type SingleBinaryOperatorComparatorApplier<
  LeftHandExpr extends ExpressionBase<any>,
  Operator extends
    | OperatorBinaryComparator<'!='>
    | OperatorBinaryComparator<'='>
    | OperatorBinaryComparator<'<'>
    | OperatorBinaryComparator<'<='>
    | OperatorBinaryComparator<'>='>
    | OperatorBinaryComparator<'>'>
    | OperatoryBinarySimilarity<'LIKE', true>
    | OperatoryBinarySimilarity<'LIKE', false>,
  S extends BaseDbDiscriminator,
> = IsAny<LeftHandExpr> extends true
  ? SingleBinaryOperatorComparator<Operator, any, LeftHandExpr, S>
  : LeftHandExpr extends ExpressionBase<infer DataType>
    ? DataType extends Operator['supportedDataTypes'][number]
      ? SingleBinaryOperatorComparator<Operator, DataType, LeftHandExpr, S>
      : never
    : never;

type SingleBinaryOperatorLogicalApplier<
  LeftHandExpr extends ExpressionBase<any>,
  Operator extends OperatorBinaryLogical<'AND'> | OperatorBinaryLogical<'OR'>,
  S extends BaseDbDiscriminator,
> = IsAny<LeftHandExpr> extends true
  ? LogicalBinaryApplier<LeftHandExpr, S>
  : LeftHandExpr extends ExpressionBase<infer DataType>
    ? DataType extends Operator['supportedDataTypes'][number]
      ? LogicalBinaryApplier<LeftHandExpr, S>
      : TypecheckError<
          `Can't perform AND on non-boolean data type`,
          { dataType: DataType }
        >
    : LogicalBinaryApplier<LeftHandExpr, S>;

type LogicalBinaryApplier<
  LeftHandExpr extends ExpressionBase<DataTypeBase>,
  S extends BaseDbDiscriminator,
> = <
  Value extends
    | LeftHandExpr['dataType']['narrowedType']
    | ExpressionBuilderShape<any>,
>(
  value: Value
) => ExpressionBuilder<ExpressionBase<DataTypeBoolean>, S>;

export type DataTypeFromExpression<Expr extends ExpressionBase<any>> =
  Expr extends ExpressionBase<infer U> ? U : never;

type InBinaryOperatorApplier<
  LeftHandExpr extends ExpressionBase<any>,
  Op extends 'IN' | 'NOT IN',
  S extends BaseDbDiscriminator,
> = <
  const Values extends
    | ReadonlyArray<
        | DataTypeFromExpression<LeftHandExpr>['narrowedType']
        | DataTypeFromExpression<LeftHandExpr>['baseExpression']
      >
    | {
        _debug: () => Omit<QueryBuilderParams<S>, 'select'> & {
          select: readonly [SelectionArrayItem];
        };
      },
>(
  value: Values
) => ExpressionBuilder<
  ExpressionSubqueryBinary<
    LeftHandExpr,
    Op,
    Values extends infer U extends ReadonlyArray<
      | DataTypeFromExpression<LeftHandExpr>['narrowedTypes']
      | DataTypeFromExpression<LeftHandExpr>['baseExpression']
    >
      ? SelectQueryBuilder<
          {
            entities: [];
            groupByClause: [];
            whereClause: undefined;
            select: ToExpressionList<
              DataTypeFromExpression<LeftHandExpr>,
              U,
              S
            >;
            isExplicitSelect: true;
            conditions: any;
            orderBy: undefined;
            queryName: undefined;
          },
          S
        >
      : Values,
    S
  >,
  S
>;

export type ToExpressionList<
  DataType extends DataTypeBase,
  T extends ReadonlyArray<
    DataType['narrowedType'] | ExpressionBuilder<DataType['baseExpression'], S>
  >,
  S extends BaseDbDiscriminator,
> = {
  [Key in keyof T]: T[Key] extends DataType['narrowedType']
    ? DataType['constExpression']
    : T[Key] extends DataType['baseExpression']
      ? T[Key] extends infer U extends ExpressionBuilder<any, S>
        ? U['_expression']
        : never
      : never;
};
