export function pick<
  T extends object,
  const PickBy extends ReadonlyArray<keyof T>,
>(value: T, pickBy: PickBy): Pick<T, PickBy[number]> {
  return pickBy.reduce(
    (acc, key) => {
      return Object.assign(
        acc,
        key in value
          ? {
              [key]: value[key as keyof T],
            }
          : {}
      );
    },
    {} as Pick<T, PickBy[number]>
  );
}
