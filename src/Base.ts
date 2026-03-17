import type { GenericAny } from '@/core-utils';
import type { ConstantBase } from './constants/base';
import type { IndexDefinition } from './ddl/index-builder/index-definition';
import type { DdlIndexDefinition } from './ddl/table';
import type { ExpressionColumn } from './expressions/ExpressionColumn';
import type { QueryBuilderParams } from './QueryBuilderParams';
import type { SqlString } from './sql-string';
import type { TableIntrospectOptions } from './table-from-schema-builder';
import type { TableNodeForValues } from './values-builder';

// Create a unique symbol type for db instances

export interface DataTypeBase {
  class: 'data_type';
  type: string;
  narrowedType: GenericAny;
  baseExpression: ExpressionBase<GenericAny>;
  constExpression: ConstantBase<GenericAny>;
}

export type ColumnReference = [
  column: ExpressionColumn<GenericAny, GenericAny, GenericAny>,
  isAggregate: boolean,
];

export interface AstNode {
  /**
   * The class of node
   */
  class: string;
  /**
   * Also can think of this as the "subclass"
   */
  variant: string;
  /**
   * There may be many node types for each variant.
   * A "type" should represent a very specific AST Node type
   */
  type: string;
}

export interface ExpressionBase<DataType extends DataTypeBase> extends AstNode {
  class: 'expression';
  dataType: DataType;
  isAggregate: boolean;
  columnReferences: ReadonlyArray<ColumnReference>;
  inferredAliases?: ReadonlyArray<string>;
}

export interface OperatorBase extends AstNode {
  class: 'operator';
}

export interface ClauseBase<DataType extends DataTypeBase> extends AstNode {
  class: 'clause';
  dataType: DataType;
  variant: string;
}

/**
 * Configuration options for a single column in model generation.
 */
export interface ColumnModelOptions {
  /**
   * Override the column name in the generated model.
   * Should be in camelCase - will be transformed to snake_case as needed.
   */
  nameOverride?: string;
  /**
   * If true, this column will be excluded from the generated model.
   * Useful for computed columns or columns that shouldn't be synced.
   */
  ignore?: boolean;
}

/**
 * Configuration for a custom derived column in model generation.
 */
export interface CustomColumnOptions {
  /**
   * SQL expression to compute this column's value.
   * The expression should reference lowercase column names as they appear in Snowflake.
   * Example: "round(currency_conversion:original_amount::int / 100, 2)"
   */
  expression: string;
  /**
   * The Snowflake data type for this column.
   * Used for categorizing the column in the final SELECT.
   * Defaults to 'varchar' if not specified.
   */
  type?:
    | 'varchar'
    | 'integer'
    | 'float'
    | 'boolean'
    | 'timestamp'
    | 'variant'
    | 'object';
}

/**
 * Configuration for generating external model representations of a table.
 * @template Schema - The schema type for the table, used to strongly type columnOptions keys
 * @template PrimaryKey - The primary key column name(s), excluded from columnOptions
 */
export interface TableModelOptions<
  Schema = unknown,
  PrimaryKey extends string = never,
> {
  /**
   * When true, a DBT model will be generated for this table.
   * The model will be output to packages/data/dbt_cloud/models/cockroachdb/
   * with the naming pattern cdb_<table_name>.sql
   */
  dbt?: boolean;

  /**
   * Optional per-column configuration for model generation.
   * Keys must be valid column names from the schema (excluding primary keys).
   */
  columnOptions?: Partial<
    Record<Exclude<keyof Schema & string, PrimaryKey>, ColumnModelOptions>
  >;

  /**
   * Custom derived columns to add to the generated model.
   * Keys are column names in camelCase (will be converted to snake_case).
   * Values contain the SQL expression and optional type information.
   */
  customColumns?: Record<string, CustomColumnOptions>;
}

// Default to the base DbSymbol type for backward compatibility
export interface TableBase<S extends BaseDbDiscriminator>
  extends BaseDb<S>,
    AstNode {
  class: 'table';
  variant: 'table';
  tableName: string;
  schema: string;
  type: 'table' | 'subquery';
  columnSchema: {
    [Key in string]: TableColumnBase;
  };
  defaultAlias: string;
  subquery?: QueryBuilderParams<S>;
  valuesTable?: TableNodeForValues<GenericAny>;
  primaryKey: string[];
  _internalIndexes:
    | Record<string, IndexDefinition<GenericAny, S, never>>
    | undefined;
  indexes: Record<string, DdlIndexDefinition> | undefined;
  /**
   * Defines whether or not we should perform introspection on this table
   * for the purposes of generating a migration
   */
  introspection?: TableIntrospectOptions;
  /**
   * Configuration for generating external model representations (e.g., DBT models)
   */
  models?: TableModelOptions;
  $getSchema?: () => GenericAny;
}

export type BaseDbDiscriminator = symbol & {
  _db: string;
};

export interface BaseDb<T extends BaseDbDiscriminator> {
  _databaseType: T;
}

export interface TableColumnBase extends AstNode {
  class: 'table_column';
  variant: 'column';
  type: 'column';
  dataType: DataTypeBase;
  columnName: string;
  isOptionalForInsert?: boolean;
  default?: SqlString;
  computedExpression?: SqlString;
}
