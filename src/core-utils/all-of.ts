export type AllOf<T extends ReadonlyArray<boolean>> = T[number] extends true
  ? true
  : false;
