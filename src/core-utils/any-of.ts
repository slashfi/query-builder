export type AnyOf<T extends ReadonlyArray<boolean>> = T extends [
  infer U,
  ...infer J extends ReadonlyArray<boolean>,
]
  ? U extends true
    ? true
    : AnyOf<J>
  : false;
