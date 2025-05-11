export function filterMap<T, R>(
  arr: T[],
  mapper: (val: T, index: number) => R | undefined | null
): R[] {
  return arr.reduce((acc: R[], value, index) => {
    const mapResult = mapper(value, index);
    if (mapResult !== undefined && mapResult !== null) {
      acc.push(mapResult);
    }
    return acc;
  }, []);
}
