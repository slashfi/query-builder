/**
 * This function ensures that code will not compile if it's possible to reach it.
 * This won't actually throw in production
 */
export function typecheckUnreachable(x: never): void;
export function typecheckUnreachable<T>(x: never, returning: T): T;
export function typecheckUnreachable(...props: any[]) {
  if (props.length === 2) {
    return props[1];
  }
}
