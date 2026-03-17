import type { GenericAny } from './generic-any';

/**
 * This function ensures that code will not compile if it's possible to reach it.
 * Use it in the default case of a switch on a variable of union type when you want to force the switch to be exhaustive.
 */
export const assertUnreachable = (x: never): never => {
  throw new Error(`Unreachable code: ${JSON.stringify(x, undefined, 2)}`);
};

/**
 * This function ensures that code will not compile if it's possible to reach it.
 * This won't actually throw in production
 */
export function typecheckUnreachable(x: never): void;
export function typecheckUnreachable<T>(x: never, returning: T): T;
export function typecheckUnreachable(...props: GenericAny[]) {
  if (props.length === 2) {
    return props[1];
  }
}
