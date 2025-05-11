export interface TypecheckError<Message extends string, OriginalInput> {
  message: `TypecheckError: ${Message}`;
  originalInput: OriginalInput;
}
