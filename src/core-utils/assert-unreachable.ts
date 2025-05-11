/**
 * This function ensures that code will not compile if it's possible to reach it.
 * Use it in the default case of a switch on a variable of union type when you want to force the switch to be exhaustive.
 * For example, if you want certain slightly-differing logic to be run regardless of the type (including potential future types)
 * and want to make sure that if someone adds a type to the union type they add the logic as well.
 * Search assertUnreachable in the codebase for example uses.
 */
export const assertUnreachable = (x: never): never => {
  throw new Error(`Unreachable code: ${JSON.stringify(x, undefined, 2)}`);
};
