import type { GenericAny } from './generic-any';
import type { UnionToIntersection } from './union-to-intersection';

type LastOf<T> = UnionToIntersection<
  T extends GenericAny ? () => T : never
> extends () => infer R
  ? R
  : never;

/**
 * Pulled from: https://stackoverflow.com/a/55128956
 */
export type TuplifyUnion<T, Acc extends unknown[] = [], L = LastOf<T>> = [
  T,
] extends [never]
  ? Acc
  : TuplifyUnion<Exclude<T, L>, [...Acc, L]>;
