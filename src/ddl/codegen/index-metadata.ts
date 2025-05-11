/**
 * Base interface for index metadata
 */
export interface IndexMetadata {
  columns: string[];
  storing: string[] | never;
  partial: string | never;
}

/**
 * Base interface for table index metadata
 */
export interface TableIndexMetadata {
  [indexName: string]: IndexMetadata;
}

/**
 * Index metadata for all tables in the database. This is augmented by the codegen build step
 */
export interface __queryBuilderIndexes {
  [tableName: string]: {
    [indexName: string]: {
      columns: {
        [columnName: string]: {
          column: boolean;
          storing: boolean;
          partial: boolean;
          requiredColumns: string[]; // List of columns that must be specified
        };
      };
      columnsOrder: string[];
      minimumSufficientColumns: string[];
      unique: boolean;
      predicate?: string | undefined;
    };
  };
}
