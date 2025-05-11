import type { Expand } from './expand';

export type MakeRequired<T, Keys extends keyof T> = Expand<
  {
    [Key in Exclude<keyof T, Keys>]: T[Key];
  } & {
    [Key in Keys]-?: NonNullable<T[Key]>;
  }
>;
