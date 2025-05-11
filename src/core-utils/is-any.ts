/**
 * Checks if a type is `any`. Returns `true` or `false`
 */
export type IsAny<T> = DoubleAnyCheck<T> extends true
  ? true extends DoubleAnyCheck<T>
    ? true
    : false
  : false;

type DoubleAnyCheck<T> = T extends any ? (any extends T ? true : false) : false;
