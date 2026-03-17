import type { GenericAny } from './generic-any';

export type UnionToIntersection<U> = (
  U extends GenericAny
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;
