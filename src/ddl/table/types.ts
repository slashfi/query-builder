import type { DataTypeBase, ExpressionBase } from '../../Base';
import type { DataTypeBoolean } from '../../DataType';
import type { ExpressionBuilderShape } from '../../ExpressionBuilder';
import type { SqlString } from '../../sql-string';

/**
 * Column definition with required fields
 */
export interface ColumnDefinition {
  name: string;
  dataType: DataTypeBase;
  constraints: ColumnConstraint[];
  default: SqlString | undefined;
}

/**
 * Base table constraint interface
 */
interface BaseTableConstraint {
  name: string | undefined;
}

/**
 * Primary key constraint
 */
export interface PrimaryKeyConstraint extends BaseTableConstraint {
  type: 'PRIMARY KEY';
  columns: string[];
}

/**
 * Foreign key constraint
 */
export interface ForeignKeyConstraint extends BaseTableConstraint {
  type: 'FOREIGN KEY';
  columns: string[];
  referenceTable: string;
  referenceSchema: string;
  referenceColumns: string[];
  actions:
    | {
        onDelete: string | undefined;
        onUpdate: string | undefined;
      }
    | undefined;
}

/**
 * Unique constraint
 */
export interface UniqueConstraint extends BaseTableConstraint {
  type: 'UNIQUE';
  columns: string[];
  nullsNotDistinct: boolean | undefined;
}

/**
 * Check constraint
 */
export interface CheckConstraint extends BaseTableConstraint {
  type: 'CHECK';
  expression: string;
}

/**
 * Union type for all table constraints
 */
export type TableConstraint =
  | PrimaryKeyConstraint
  | ForeignKeyConstraint
  | UniqueConstraint
  | CheckConstraint;

/**
 * Table definition with required fields
 */
export interface TableDefinition {
  name: string;
  schema: string;
  columns: ColumnDefinition[];
  constraints: TableConstraint[];
  ifNotExists: boolean | undefined;
  temporary: boolean | undefined;
  onCommit: string | undefined;
  storageParameters: StorageParameters | undefined;
  locality:
    | {
        type: string;
        region: string | undefined;
        asPrimaryKey: boolean | undefined;
      }
    | undefined;
  partition:
    | {
        type: string;
        columns: string[];
        subpartition:
          | {
              type: string;
              columns: string[];
            }
          | undefined;
      }
    | undefined;
}

/**
 * Column constraint with required fields
 */
export interface ColumnConstraint {
  type: string;
  name: string | undefined;
  value: string | number | undefined;
}

/**
 * Previous state for alter column action
 */
export interface AlterColumnPreviousState {
  dataType: string;
  nullable: boolean;
  default?: SqlString;
}

/**
 * Add column action
 */
export interface AddColumnAction {
  type: 'ADD COLUMN';
  name: string;
  columnDefinition: ColumnDefinition;
  // No previous state needed since down migration just drops the column
}

/**
 * Drop column action
 */
export interface DropColumnAction {
  type: 'DROP COLUMN';
  name: string;
  cascade: boolean;
  // Need the full column definition to recreate it
  previousState:
    | {
        dataType: DataTypeBase;
        constraints: ColumnConstraint[];
        default?: SqlString;
      }
    | undefined;
}

/**
 * Alter column action
 */
export interface AlterColumnAction {
  type: 'ALTER COLUMN';
  name: string;
  alterColumnAction: {
    type:
      | 'SET DATA TYPE'
      | 'SET NOT NULL'
      | 'DROP NOT NULL'
      | 'SET DEFAULT'
      | 'DROP DEFAULT';
    value: string | undefined;
  };
  previousState: AlterColumnPreviousState | undefined;
}

/**
 * Add constraint action
 */
export interface AddConstraintAction {
  type: 'ADD CONSTRAINT';
  name: string;
  constraint: TableConstraint;
  // No previous state needed since down migration just drops the constraint
}

/**
 * Drop constraint action
 */
export interface DropConstraintAction {
  type: 'DROP CONSTRAINT';
  name: string;
  cascade: boolean;
  // Need the full constraint definition to recreate it
  previousState:
    | {
        constraint: TableConstraint;
      }
    | undefined;
}

/**
 * Drop table action
 */
export interface DropTableAction {
  type: 'DROP TABLE';
  cascade: boolean;
  // Need the full table definition to recreate it
  previousState:
    | {
        columns: ColumnDefinition[];
        constraints: TableConstraint[];
      }
    | undefined;
}

/**
 * Drop index action
 */
export interface DropIndexAction {
  type: 'DROP INDEX';
  name: string;
  // Need the full index definition to recreate it
  previousState:
    | {
        table: string;
        schema: string;
        expressions: SqlString[];
        unique: boolean;
        method: string | undefined;
        ascending: boolean[] | undefined;
        storingColumns: string[] | undefined;
        nullsNotDistinct: boolean;
        withClause: StorageParameters | undefined;
        storageParameters: StorageParameters | undefined;
        whereClause: SqlString | undefined;
      }
    | undefined;
}

/**
 * Alter primary key action
 */
export interface AlterPrimaryKeyAction {
  type: 'ALTER PRIMARY KEY';
  columns: string[];
  // Whether to keep the old primary key as a secondary index
  keepOldPrimaryKey: boolean;
  // Need the previous primary key columns to create secondary index or for down migration
  previousState:
    | {
        columns: string[];
      }
    | undefined;
}

export type AlterTableAction =
  | AddColumnAction
  | DropColumnAction
  | AlterColumnAction
  | AddConstraintAction
  | DropConstraintAction
  | DropTableAction
  | DropIndexAction
  | AlterPrimaryKeyAction;

/**
 * Alter table definition
 */
export interface AlterTableDefinition {
  name: string;
  schema: string;
  actions: AlterTableAction[];
}

/**
 * Storage parameters for indexes
 */
export interface StorageParameters {
  [key: string]: string | number | boolean;
}

/**
 * Definition for database indexes
 */
export interface DdlIndexDefinition<Name extends string = string> {
  name: Name;
  table: string;
  schema: string;
  expressions: SqlString[];
  unique: boolean;
  concurrently: boolean;
  ifNotExists: boolean;
  nullsNotDistinct: boolean;
  method: string | undefined;
  ascending: boolean[] | undefined;
  storingColumns: string[] | undefined;
  withClause: StorageParameters | undefined;
  storageParameters: StorageParameters | undefined;
  whereClause?:
    | ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
    | undefined;
  previousState?:
    | {
        expressions: SqlString[];
        unique: boolean;
        method: string | undefined;
        ascending: boolean[] | undefined;
        storingColumns: string[] | undefined;
        nullsNotDistinct: boolean;
        withClause: StorageParameters | undefined;
        storageParameters: StorageParameters | undefined;
        whereClause?: SqlString | undefined;
      }
    | undefined;
}
