import { compareTypes, mapObject } from '@/core-utils';
import type { DataTypeBase, ExpressionBase } from './Base';
import type { ConstantForArray } from './constants/ConstantForArray';
import type { ConstantForBoolean } from './constants/ConstantForBoolean';
import type { ConstantForFloat } from './constants/ConstantForFloat';
import type { ConstantForInteger } from './constants/ConstantForInteger';
import type { ConstantForJson } from './constants/ConstantForJson';
import type { ConstantForTimestamp } from './constants/ConstantForTimestamp';
import type { ConstantForVarchar } from './constants/ConstantForVarchar';
import type { TypescriptTypeFromDataType } from './util';

export const createDataTypeVarchar =
  nullableDataTypeConstructor<DataTypeVarchar>('varchar');
export const createDataTypeBoolean =
  nullableDataTypeConstructor<DataTypeBoolean>('boolean');

export const createDataTypeInteger =
  nullableDataTypeConstructor<DataTypeInteger>('int');
export const createDataTypeFloat =
  nullableDataTypeConstructor<DataTypeFloat>('float');

export function nullableDataTypeConstructor<T extends DataTypeBase>(
  type: T['type']
) {
  return function <
    Type extends T,
    IsNullable extends boolean = false,
  >(options?: {
    isNullable: IsNullable;
  }): IsNullable extends true ? DataTypeUnion<[Type, DataTypeNull]> : Type {
    const dataType = {
      class: 'data_type',
      baseExpression: undefined as any,
      constExpression: undefined as any,
      narrowedType: undefined as any,
      type,
    } as T;
    return (
      options?.isNullable
        ? createDataTypeUnion([dataType, createDataTypeNull()])
        : dataType
    ) as IsNullable extends true ? DataTypeUnion<[Type, DataTypeNull]> : Type;
  };
}

export function createDataTypeArray<
  T extends DataTypeBase,
  IsNullable extends boolean,
>(
  data: T,
  options?: { isNullable?: IsNullable }
): IsNullable extends true
  ? DataTypeUnion<[DataTypeArray<T>, DataTypeNull]>
  : DataTypeArray<T> {
  if (options?.isNullable) {
    return createDataTypeUnion([
      createDataTypeArray(data, { isNullable: false }),
      createDataTypeNull(),
    ]) as IsNullable extends true
      ? DataTypeUnion<[DataTypeArray<T>, DataTypeNull]>
      : DataTypeArray<T>;
  }

  return {
    class: 'data_type',
    type: 'array',
    primitiveDataType: data,
    baseExpression: undefined as any,
    constExpression: undefined as any,
    narrowedType: undefined as any,
  } as IsNullable extends true
    ? DataTypeUnion<[DataTypeArray<T>, DataTypeNull]>
    : DataTypeArray<T>;
}

export const createDataTypeTimestamp =
  nullableDataTypeConstructor<DataTypeTimestamp>('timestamp');

export const createDataTypeJson =
  nullableDataTypeConstructor<DataTypeJson>('json');

export function createDataTypeTabularColumns<
  Columns extends {
    [Key in string]: DataTypeBase;
  },
  IsNullable extends boolean,
>(
  columnData: Columns,
  options?: {
    isNullable: IsNullable;
  }
): DataTypeTabularColumns<Columns, IsNullable> {
  const finalColumnData = (() => {
    if (options?.isNullable) {
      return mapObject(columnData, (val) => makeDataTypeNullable(val));
    }

    return columnData;
  })();
  return {
    class: 'data_type',
    type: 'tabular_columns',
    columnDataTypes: finalColumnData as any,
    baseExpression: undefined as any,
    constExpression: undefined as any,
    narrowedType: undefined as any,
  };
}

export function createDataTypeVoid(): DataTypeVoid {
  return {
    class: 'data_type',
    type: 'void',
    baseExpression: undefined as any,
    constExpression: undefined as any,
    narrowedType: undefined as any,
  };
}

export function createDataTypeNull(): DataTypeNull {
  return {
    class: 'data_type',
    type: 'null',
    baseExpression: undefined as any,
    constExpression: undefined as any,
    narrowedType: undefined as any,
  };
}

export function createDataTypeUnion<
  const T extends ReadonlyArray<DataTypeBase>,
>(items: T): DataTypeUnion<T> {
  return {
    class: 'data_type',
    type: 'union',
    values: items,
    baseExpression: undefined as any,
    constExpression: undefined as any,
    narrowedType: undefined as GetTypescriptTypeFromDataTypeTuple<T>[number],
  };
}

export function createDataTypeTuple<T extends ReadonlyArray<DataTypeBase>>(
  items: T
): DataTypeTuple<T> {
  return {
    class: 'data_type',
    type: 'tuple',
    values: items,
    baseExpression: undefined as any,
    constExpression: undefined as any,
    narrowedType: undefined as GetTypescriptTypeFromDataTypeTuple<T>[number],
  };
}

export function isDataTypeNullable<T extends DataTypeBase>(
  dataType: T
): boolean {
  if (isUnionDataType(dataType)) {
    return dataType.values.some((dt) => isDataTypeNullable(dt));
  }

  return isNullDataType(dataType);
}

export function isNullDataType(
  dataType: DataTypeBase
): dataType is DataTypeNull {
  return dataType.type === 'null';
}
export function isUnionDataType(
  dataType: DataTypeBase
): dataType is DataTypeUnion<ReadonlyArray<DataTypeBase>> {
  return dataType.type === 'union';
}

export interface DataTypeVarchar<T extends string = string>
  extends DataTypeBase {
  type: 'varchar';
  narrowedType: NonNullable<T>;
  baseExpression: ExpressionBase<DataTypeVarchar<NonNullable<T>>>;
  constExpression: ConstantForVarchar<NonNullable<T>>;
}

export interface DataTypeBoolean<T extends boolean = boolean>
  extends DataTypeBase {
  type: 'boolean';
  narrowedType: NonNullable<T>;
  baseExpression: ExpressionBase<DataTypeBoolean<T>>;
  constExpression: ConstantForBoolean<NonNullable<T>>;
}

export interface DataTypeInteger<T extends number = number>
  extends DataTypeBase {
  type: 'int';
  narrowedType: NonNullable<T>;
  baseExpression: ExpressionBase<DataTypeInteger<T>>;
  constExpression: ConstantForInteger<NonNullable<T>>;
}

export interface DataTypeFloat<T extends number = number> extends DataTypeBase {
  type: 'float';
  narrowedType: NonNullable<T>;
  baseExpression: ExpressionBase<DataTypeFloat<T>>;
  constExpression: ConstantForFloat<NonNullable<T>>;
}

export interface DataTypeArray<Primitive extends DataTypeBase = DataTypeBase>
  extends DataTypeBase {
  type: 'array';
  primitiveDataType: Primitive;
  narrowedType: Primitive['narrowedType'][];
  baseExpression: ExpressionBase<DataTypeArray<Primitive>>;
  constExpression: ConstantForArray<Primitive>;
}

export interface DataTypeTimestamp<T extends Date = Date> extends DataTypeBase {
  type: 'timestamp';
  narrowedType: NonNullable<T>;
  baseExpression: ExpressionBase<DataTypeTimestamp<T>>;
  constExpression: ConstantForTimestamp;
}

export interface DataTypeJson<T extends any = { [Key in string]: any }>
  extends DataTypeBase {
  type: 'json';
  narrowedType: NonNullable<T>;
  baseExpression: ExpressionBase<DataTypeJson<T>>;
  constExpression: ConstantForJson<NonNullable<T>>;
}

export interface DataTypeTabularColumns<
  T extends { [Key in string]: DataTypeBase } = {
    [Key in string]: DataTypeBase;
  },
  IsNullable extends boolean = false,
> extends DataTypeBase {
  type: 'tabular_columns';
  columnDataTypes: {
    [Key in keyof T]: IsNullable extends true
      ? MakeDataTypeNullable<T[Key]>
      : T[Key];
  };
  narrowedType:
    | {
        [Key in keyof T]: TypescriptTypeFromDataType<T[Key]>;
      }
    | (IsNullable extends true ? undefined : never);
}

export interface DataTypeTuple<
  Values extends ReadonlyArray<DataTypeBase> = ReadonlyArray<DataTypeBase>,
> extends DataTypeBase {
  type: 'tuple';
  values: Values;
  narrowedType: GetTypescriptTypeFromDataTypeTuple<Values>;
}

export interface DataTypeVoid extends DataTypeBase {
  type: 'void';
  narrowedType: void;
}

export interface DataTypeNull extends DataTypeBase {
  type: 'null';
  narrowedType: undefined;
}

type GetTypescriptTypeFromDataTypeTuple<
  Values extends ReadonlyArray<DataTypeBase>,
> = {
  [Key in keyof Values]: Values[Key] extends DataTypeBase
    ? Values[Key]['narrowedType']
    : never;
};

export interface DataTypeUnion<T extends ReadonlyArray<DataTypeBase>>
  extends DataTypeBase {
  type: 'union';
  values: T;
  narrowedType: GetTypescriptTypeFromDataTypeTuple<T>[number];
}

export type DataTypes =
  | DataTypeVarchar
  | DataTypeInteger
  | DataTypeFloat
  | DataTypeBoolean
  | DataTypeTabularColumns
  | DataTypeJson
  | DataTypeArray
  | DataTypeTuple
  | DataTypeTimestamp
  | DataTypeUnion<ReadonlyArray<DataTypeBase>>;

export const allDataTypes = [
  createDataTypeFloat({ isNullable: true }),
  createDataTypeInteger({ isNullable: true }),
  createDataTypeTimestamp({ isNullable: true }),
  createDataTypeVarchar({ isNullable: true }),
  createDataTypeBoolean({ isNullable: true }),
  createDataTypeJson({ isNullable: true }),
  createDataTypeArray(createDataTypeBoolean({ isNullable: false }), {
    isNullable: true,
  }),
  createDataTypeFloat({ isNullable: false }),
  createDataTypeInteger({ isNullable: false }),
  createDataTypeTimestamp({ isNullable: false }),
  createDataTypeVarchar({ isNullable: false }),
  createDataTypeBoolean({ isNullable: false }),
  createDataTypeJson({ isNullable: false }),
  createDataTypeArray(createDataTypeBoolean({ isNullable: false }), {
    isNullable: false,
  }),
  createDataTypeUnion([]),
];

export function getDataTypes<
  const Types extends ReadonlyArray<(typeof allDataTypes)[number]['type']>,
>(options: {
  pick: Types;
}): {
  [Key in keyof Types]: Types[Key] extends infer Type extends
    (typeof allDataTypes)[number]['type']
    ? Extract<(typeof allDataTypes)[number], { type: Type }>
    : never;
} {
  return options.pick
    .map((pick) => allDataTypes.find((type) => type.type === pick))
    .filter((val) => !!val) as any;
}

export type GetNonNullableDataType<T extends DataTypeBase> =
  T extends DataTypeUnion<infer U extends ReadonlyArray<DataTypeBase>>
    ? U extends [
        infer First extends DataTypeBase,
        ...infer Rest extends ReadonlyArray<DataTypeBase>,
      ]
      ? First extends DataTypeNull
        ? GetNonNullableDataType<Rest[number]>
        : First
      : never
    : T;

export type IsDataTypeNullable<T extends DataTypeBase> =
  T extends DataTypeUnion<ReadonlyArray<DataTypeBase>>
    ? DataTypeNull extends T['values'][number]
      ? true
      : false
    : false;

export type MakeDataTypeNullable<T extends DataTypeBase> =
  T extends DataTypeUnion<infer U>
    ? DataTypeNull extends U[number]
      ? T
      : DataTypeUnion<[...U, DataTypeNull]>
    : DataTypeUnion<[T, DataTypeNull]>;

export function makeDataTypeNullable<T extends DataTypeBase>(
  dataType: T
): MakeDataTypeNullable<T> {
  if (isDataTypeNullable(dataType)) {
    return dataType as any;
  }
  if (isUnionDataType(dataType)) {
    return {
      ...dataType,
      values: [...dataType.values, createDataTypeNull()],
    } as any;
  }

  return createDataTypeUnion([
    dataType,
    createDataTypeNull(),
  ]) as MakeDataTypeNullable<T>;
}

export function getNonNullableDataType(dataType: DataTypeBase): DataTypeBase {
  const finalDataType = (() => {
    if (isUnionDataType(dataType)) {
      return dataType.values.find((val) => !isNullDataType(val));
    }

    return dataType;
  })();
  if (!finalDataType || isNullDataType(finalDataType)) {
    throw new Error('Unable to get non-nullable data type');
  }

  return finalDataType;
}

type MergeIntoDataTypeUnion<
  A extends DataTypeUnion<ReadonlyArray<DataTypeBase>>,
  B extends DataTypeBase,
> = B extends DataTypeUnion<
  readonly [
    infer First extends DataTypeBase,
    ...infer J extends ReadonlyArray<DataTypeBase>,
  ]
>
  ? MergeIntoDataTypeUnion<MergeIntoDataTypeUnion<A, First>, DataTypeUnion<J>>
  : B extends A['values'][number]
    ? A
    : B extends DataTypeUnion<[]>
      ? A
      : DataTypeUnion<[...A['values'], B]>;

export type MergeDataTypesIntoUnion<
  A extends DataTypeBase,
  B extends DataTypeBase,
> = A extends DataTypeUnion<ReadonlyArray<DataTypeBase>>
  ? MergeIntoDataTypeUnion<A, B>
  : B extends DataTypeUnion<ReadonlyArray<DataTypeBase>>
    ? MergeIntoDataTypeUnion<B, A>
    : ExtendsEachOther<A, B> extends true
      ? A
      : DataTypeUnion<[A, B]>;

type ExtendsEachOther<A, B> = A extends B
  ? B extends A
    ? true
    : false
  : false;

compareTypes<{
  a: MergeDataTypesIntoUnion<DataTypeBoolean, DataTypeInteger>;
  b: DataTypeUnion<[DataTypeBoolean, DataTypeInteger]>;
}>()
  .expect('a')
  .toBeEquivalent('b');

compareTypes<{
  a: MergeDataTypesIntoUnion<
    DataTypeNull,
    DataTypeUnion<[DataTypeNull, DataTypeBoolean]>
  >;
  b: DataTypeUnion<[DataTypeNull, DataTypeBoolean]>;
}>()
  .expect('a')
  .toBeEquivalent('b');

compareTypes<{
  a: MergeDataTypesIntoUnion<
    DataTypeNull,
    DataTypeUnion<[DataTypeNull, DataTypeBoolean]>
  >;
  b: DataTypeUnion<[DataTypeNull, DataTypeBoolean]>;
}>()
  .expect('a')
  .toBeEquivalent('b');

compareTypes<{
  a: MergeDataTypesIntoUnion<
    DataTypeUnion<[DataTypeBoolean, DataTypeNull]>,
    DataTypeUnion<[DataTypeBoolean, DataTypeNull]>
  >;
  b: DataTypeUnion<[DataTypeBoolean, DataTypeNull]>;
}>()
  .expect('a')
  .toBeEquivalent('b');

compareTypes<{
  a: MergeDataTypesIntoUnion<DataTypeBoolean, DataTypeBoolean>;
  b: DataTypeBoolean;
}>()
  .expect('a')
  .toBeEquivalent('b');
