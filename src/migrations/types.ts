import type { SqlString } from '../sql-string';

/**
 * Core constraints interface for migrations
 */
export interface MigrationConstraints {
  [tableName: string]: {
    must_exist: boolean;
    columns: {
      [columnName: string]: {
        type: string;
        nullable: boolean;
      };
    };
    indexes: {
      [indexName: string]: {
        must_exist: boolean;
      };
    };
  };
}

/**
 * Format-agnostic representation of a migration
 */
export interface MigrationDefinition {
  name: string;
  constraints: MigrationConstraints;
  up: SqlString[];
  down: SqlString[];
  tables: string[]; // affected tables
}

/**
 * Base interface for migration formatters
 */
export interface MigrationFormatter {
  /**
   * Format a migration definition into the target format
   * Returns either a single file content or multiple files
   */
  format(migration: MigrationDefinition): string;
}
