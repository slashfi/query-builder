/**
 * Let's the VSCode Typescript language server GOTO references on the
 * original object you mapped
 */
export type OriginalReferenceableObject<T, K> = Pick<
  {
    [Key in keyof K]: Key extends keyof T ? T[Key] : never;
  },
  Extract<keyof T, keyof K>
> &
  Omit<T, keyof K>;
