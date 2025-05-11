export function mapObject<T extends { [Key in string]: any }, R>(
  object: T,
  map: (value: T[keyof T], key: string) => R
): {
  [Key in keyof T]: R;
} {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, map(value, key)])
  ) as any;
}
