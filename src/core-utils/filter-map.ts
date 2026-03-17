/**
 * Filters out null and undefined values from an array
 */
export function filterUndefined<T>(
  arr: (T | undefined | null)[]
): NonNullable<T>[] {
  return arr.filter(
    (val): val is NonNullable<T> => val !== undefined && val !== null
  );
}

/**
 * Maps an array and then filters out null/undefined results
 */
export function filterMap<T, R>(
  arr: readonly T[],
  mapper: (val: T, index: number) => R | undefined | null
): R[] {
  const result: R[] = [];
  for (let i = 0; i < arr.length; i++) {
    const mapped = mapper(arr[i], i);
    if (mapped !== undefined && mapped !== null) {
      result.push(mapped);
    }
  }
  return result;
}
