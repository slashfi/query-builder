/**
 * Converts an intersection of objects into one nice human-readable type
 */
export type Expand<T> = T extends infer O
  ? { [Key in keyof O]: O[Key] }
  : never;
