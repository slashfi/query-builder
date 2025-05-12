import type { ConstantBase } from './constants/base';
import type { IndexDefinition } from './ddl/index-builder/index-definition';
import type { DdlIndexDefinition } from './ddl/table';
import type { ExpressionColumn } from './expressions/expression-column';
import type { QueryBuilderParams } from./expressions/expression-column
import type { SqlString } from './sql-string';
import type { TableIntrospectOptions } from './table-from-schema-builder';
import type { TableNodeForValues } from './values-builder';

// Create a unique symbol type for db instances

export interface DataTypeBase {
  class: 'data_type';
  type: string;
  narrowedType: any;
  baseExpression: ExpressionBase<any>;
  constExpression: ConstantBase<any>;
}

export type ColumnReference = [
  column: ExpressionColumn<any, any, any>,
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
  valuesTable?: TableNodeForValues<any>;
  primaryKey: string[];
  _internalIndexes: Record<string, IndexDefinition<any, S, never>> | undefined;
  indexes: Record<string, DdlIndexDefinition> | undefined;
  /**
   * Defines whether or not we should perform introspection on this table
   * for the purposes of generating a migration
   */
  introspection?: TableIntrospectOptions;
  $getSchema?: () => any;
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
}
