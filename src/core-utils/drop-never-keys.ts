import type { GenericAny } from './generic-any';
import type { OriginalReferenceableObject } from './original-referenceable-object';

export type FilterNeverKeys<T extends Record<string, GenericAny>> = {
  [Key in keyof T]: T[Key] extends never ? never : Key;
}[keyof T];

export type DropNeverKeys<T extends Record<string, GenericAny>> =
  OriginalReferenceableObject<
    {
      [Key in FilterNeverKeys<T>]: T[Key];
    },
    T
  >;
