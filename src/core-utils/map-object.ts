import type { GenericAny } from './generic-any';

export function mapObject<T extends { [Key in string]: GenericAny }, R>(
  object: T,
  map: (value: T[keyof T], key: string) => R
): {
  [Key in keyof T]: R;
} {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, map(value, key)])
  ) as GenericAny;
}
