import type { TypecheckError, UnionToIntersection } from '@/core-utils';
import type { DataTypeBase } from './Base';

/**
 * Flatten a 2D readonly array into a single readonly array
 */
export type Flat<T extends ReadonlyArray<ReadonlyArray<any>>> = T extends [
  infer U extends ReadonlyArray<any>,
  infer J extends ReadonlyArray<ReadonlyArray<any>>,
]
  ? [...U, ...Flat<J>]
  : [];

/**
 * If any item in the list contains a TypecheckError, return it.
 * Otherwise, return the original list
 */
export type CheckForTypecheckError<
  T extends ReadonlyArray<any>,
  Tail = T,
> = T extends [infer U, ...infer J extends ReadonlyArray<any>]
  ? U extends TypecheckError<any, any>
    ? U
    : CheckForTypecheckError<J, Tail>
  : T extends []
    ? Tail
    : never;

/**
 * Check if a value in the first readonly array extends one of the values of the second readonly array
 */
export type SomeValueInFirstExtendsSecond<
  T extends ReadonlyArray<any>,
  R extends ReadonlyArray<any>,
> = T extends readonly [infer U, ...infer J extends ReadonlyArray<any>]
  ? U extends R[number]
    ? true
    : SomeValueInFirstExtendsSecond<J, R>
  : false;

/**
 * Returns a new readonly array with non-never values
 */
export type FilterNeverValuesFromReadonlyArray<T extends ReadonlyArray<any>> =
  T extends readonly [infer U, ...infer J extends ReadonlyArray<any>]
    ? [U] extends [never]
      ? FilterNeverValuesFromReadonlyArray<J>
      : [U, ...FilterNeverValuesFromReadonlyArray<J>]
    : [];

export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Keep only the values that extend `Type`
 */
export type Filter<
  T extends ReadonlyArray<any>,
  Type extends T[number],
> = T extends readonly [infer U, ...infer J extends ReadonlyArray<any>]
  ? Type extends U
    ? readonly [U, ...Filter<J, Type>]
    : Filter<J, Type>
  : [];

type LastOf<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never;

export type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false,
> = true extends N ? [] : [...TuplifyUnion<Exclude<T, L>>, L];

export type TypescriptTypeFromDataType<DataType extends DataTypeBase> =
  DataType['narrowedType'];
