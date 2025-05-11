import type { TypecheckError } from './typecheck-error';

export function compareTypes<
  T extends {
    a: any;
    b: any;
  },
>() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expect<First extends 'a' | 'b'>(_: First) {
      return {
        toExtend<Second extends Exclude<'a' | 'b', First>>(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _: T[First] extends T[Second]
            ? Second
            : TypecheckError<
                `Type ${First} does not extend ${Second}.`,
                {
                  a: T['a'];
                  b: T['b'];
                }
              >
        ) {},
        toBeEquivalent<Second extends Exclude<'a' | 'b', First>>(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _: T[First] extends T[Second]
            ? T[Second] extends T[First]
              ? Second
              : TypecheckError<
                  `Not equivalent because ${Second} does not extend ${First}.`,
                  { a: T['a']; b: T['b'] }
                >
            : TypecheckError<
                `Not equivalent because ${First} does not extend ${Second}.`,
                { a: T['a']; b: T['b'] }
              >
        ) {},
      };
    },
  };
}
