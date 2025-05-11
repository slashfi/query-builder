import type { OriginalReferenceableObject } from './original-referenceable-object';

export type FilterNeverKeys<T extends Record<string, any>> = {
  [Key in keyof T]: T[Key] extends never ? never : Key;
}[keyof T];

export type FilterEmptyObjectKeys<T extends Record<string, any>> = {
  [Key in keyof T]: {} extends T[Key] ? never : Key;
}[keyof T];

export type DropNeverKeys<T extends Record<string, any>> =
  OriginalReferenceableObject<
    {
      [Key in FilterNeverKeys<T>]: T[Key];
    },
    T
  >;

export type DropEmptyObjectKeys<T extends Record<string, any>> =
  OriginalReferenceableObject<
    {
      [Key in FilterEmptyObjectKeys<T>]: T[Key];
    },
    T
  >;
