import type {
  BaseDbDiscriminator,
  ExpressionBase,
  TableBase,
} from '../../Base';
import type { DataTypeBoolean } from '../../DataType';
import type {
  ExpressionBuilder,
  ExpressionBuilderShape,
} from '../../ExpressionBuilder';
import type { ExpressionColumn } from '../../expressions/ExpressionColumn';
import type { SqlString } from '../../sql-string';
import type { IsNever } from '../../util';
import type { IndexState } from './index-builder';

export type IndexMethod = 'btree' | 'hash' | 'gin' | 'gist' | 'brin' | 'spgist';

export interface IndexOptions {
  unique?: boolean;
  concurrently?: boolean;
  method?: IndexMethod;
  inverted?: boolean;
  storageParameters?: Record<string, string | number | boolean>;
}

export type ExtractNameFromIndexDefinition<
  TableName extends string,
  Key extends string,
  T extends IndexDefinition<any, any>,
> = T extends IndexDefinition<any, any, infer Name>
  ? // If the name is never, then `${Table.tableName}_${Key}` is the name
    IsNever<Name> extends true
    ? `${TableName}_${Key}`
    : Name
  : never;

export interface IndexDefinition<
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
  Name extends string = never,
> {
  _properties: IndexState<Table, S>;

  // Builder methods
  /**
   * Set a custom name for the index. If specified, this name will be used
   * instead of the key from the indexes object.
   *
   * @example
   * ```typescript
   * .indexes(({ table, index }) => ({
   *   // Uses 'idx_email' as the index name
   *   idx_email: index(table.email),
   *
   *   // Uses 'custom_index_name' as the index name, ignoring the key
   *   some_key: index(table.email).name('custom_index_name')
   * }))
   * ```
   */
  name<Name extends string>(indexName: Name): IndexDefinition<Table, S, Name>;
  unique(): IndexDefinition<Table, S, Name>;
  concurrently(): IndexDefinition<Table, S, Name>;
  using(method: IndexMethod): IndexDefinition<Table, S, Name>;
  inverted(): IndexDefinition<Table, S, Name>;
  where(
    condition:
      | SqlString
      | ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
  ): IndexDefinition<Table, S, Name>;
  storing(
    ...columns: Array<
      ExpressionBuilderShape<
        ExpressionColumn<
          {
            table: Table;
            alias: Table['defaultAlias'];
            isUsingAlias: false;
          },
          string,
          S
        >
      >
    >
  ): IndexDefinition<Table, S, Name>;
  /**
   * WITH parameters
   * @param params
   */
  with(
    params: NonNullable<IndexOptions['storageParameters']>
  ): IndexDefinition<Table, S, Name>;
  partitionBy(expr: 'ALL' | SqlString): IndexDefinition<Table, S, Name>;
}

/**
 * Passed into indexes as the function argument
 * to create indexes
 */
export interface IndexConfig<
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
> {
  table: {
    [K in keyof Table['columnSchema']]: ExpressionBuilder<
      ExpressionColumn<
        {
          table: Table;
          alias: Table['defaultAlias'];
          isUsingAlias: false;
        },
        Extract<K, string>,
        S
      >,
      S
    >;
  };
  index(
    ...expressions: Array<ExpressionBuilderShape<any> | SqlString>
  ): IndexDefinition<Table, S>;
}
