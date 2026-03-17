export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? U[] | undefined
    : T[P] extends object | null | undefined
      ? // Union of RecursivePartial and null if the type is nullable
        RecursivePartial<NonNullable<T[P]>> | Extract<T[P], null> | undefined
      : T[P] | undefined;
};
