import { filterUndefined, type OriginalReferenceableObject } from '@/core-utils';
import type { BaseDbDiscriminator, TableBase } from '../Base';
import { sql } from '../sql-string/index';
import type { __queryBuilderIndexes } from './codegen/index-metadata';
import type { DdlIndexDefinition } from './table';

/**
 * Allowed operations for index columns
 */
export type IndexOperation = 'eq' | 'gt' | 'lt' | 'in';

/**
 * Configuration for an index column
 */
export interface IndexColumnConfig {
  /**
   * Allowed operations on this column
   */
  operations?: IndexOperation[];
}

/**
 * Configuration for an index
 */
export interface IndexConfig<T extends readonly string[] = readonly string[]> {
  /**
   * Name of the index
   */
  name: string;

  /**
   * Per-column configuration
   */
  columns?: {
    [columnName: string]: IndexColumnConfig;
  };

  /**
   * If true, this is a unique index
   */
  unique?: boolean;

  /**
   * Minimum set of columns that must be present in the query for the index to be used
   */
  minimumSufficientColumns?: T;

  /**
   * Query restrictions
   */
  strict?: {
    columnsOnly: boolean;
  };
}

export type UserIndexOverrides<
  T extends { Table: TableBase<S> },
  S extends BaseDbDiscriminator,
> = {
  [IndexName in keyof T['Table']['indexes']]?: {
    columns?: {
      [ColumnName in keyof __queryBuilderIndexes[T['Table']['tableName']][Extract<
        keyof __queryBuilderIndexes[T['Table']['tableName']],
        IndexName
      >]['columns']]?: IndexColumnConfig;
    };
    minimumSufficientColumns?: Partial<
      __queryBuilderIndexes[T['Table']['tableName']][Extract<
        keyof __queryBuilderIndexes[T['Table']['tableName']],
        IndexName
      >]['columnsOrder']
    >;
    strict?: IndexConfig['strict'];
  };
};

export type CompiledIndexesConfig<
  T extends { Table: TableBase<S> },
  Config extends UserIndexOverrides<T, S>,
  S extends BaseDbDiscriminator,
> = {
  [K in keyof T['Table']['indexes']]: {
    index: DdlIndexDefinition;
    table: T['Table'];
    Table: T['Table'];
    friendlyIndexName: string;
    getOptions: () => Promise<{
      columns: OriginalReferenceableObject<
        {
          [ColumnName in keyof __queryBuilderIndexes[T['Table']['tableName']][Extract<
            keyof __queryBuilderIndexes[T['Table']['tableName']],
            K
          >]['columns']]: {
            operations: Config[K] extends infer U extends {
              columns: { [Name in ColumnName]: IndexColumnConfig };
            }
              ? U['columns'][ColumnName]['operations']
              : ['eq'];
          };
        },
        T['Table']['columnSchema']
      >;
      columnsOrder: __queryBuilderIndexes[T['Table']['tableName']][Extract<
        keyof __queryBuilderIndexes[T['Table']['tableName']],
        K
      >]['columnsOrder'];
      minimumSufficientColumns: Config[K] extends NonNullable<Config[K]>
        ? Config[K]['minimumSufficientColumns'] extends NonNullable<
            Config[K]['minimumSufficientColumns']
          >
          ? Config[K]['minimumSufficientColumns']
          : __queryBuilderIndexes[T['Table']['tableName']][Extract<
              keyof __queryBuilderIndexes[T['Table']['tableName']],
              K
            >]['minimumSufficientColumns']
        : __queryBuilderIndexes[T['Table']['tableName']][Extract<
            keyof __queryBuilderIndexes[T['Table']['tableName']],
            K
          >]['minimumSufficientColumns'];
      strict: Config[K] extends NonNullable<Config[K]>
        ? Config[K]['strict'] extends IndexConfig['strict']
          ? Config[K]['strict']
          : {
              columnsOnly: true;
            }
        : {
            columnsOnly: true;
          };
      predicate: __queryBuilderIndexes[T['Table']['tableName']][Extract<
        keyof __queryBuilderIndexes[T['Table']['tableName']],
        K
      >]['predicate'];
      unique: __queryBuilderIndexes[T['Table']['tableName']][Extract<
        keyof __queryBuilderIndexes[T['Table']['tableName']],
        K
      >]['unique'];
    }>;
  };
} & {
  primaryKey: PrimaryKeyIndexConfig<T, S>;
};

export interface CompiledIndexConfigBase<S extends BaseDbDiscriminator> {
  index: DdlIndexDefinition;
  table: TableBase<S>;
  /**
   * Mirrors `table` so that CompiledIndexConfigBase satisfies GenericEntityTarget<S>.
   * This lets index configs be passed directly to from() and join methods.
   */
  Table: TableBase<S>;
  friendlyIndexName: string;
  getOptions: () => Promise<{
    columns: {
      [ColumnName in string]: IndexColumnConfig;
    };
    minimumSufficientColumns: string[];
    columnsOrder: ReadonlyArray<string>;
    strict?: IndexConfig['strict'];
    predicate?: string | undefined;
    unique: boolean;
  }>;
}

/**
 * Type for the automatically-generated primary key index config.
 * This is always available on any table with a primary key defined.
 */
export type PrimaryKeyIndexConfig<
  T extends { Table: TableBase<S> },
  S extends BaseDbDiscriminator,
> = {
  index: DdlIndexDefinition;
  table: T['Table'];
  Table: T['Table'];
  friendlyIndexName: 'primaryKey';
  getOptions: () => Promise<{
    columns: {
      [K in T['Table']['primaryKey'][number]]: {
        operations: ['eq', 'in'];
      };
    };
    minimumSufficientColumns: T['Table']['primaryKey'];
    columnsOrder: T['Table']['primaryKey'];
    strict: { columnsOnly: false };
    predicate: undefined;
    unique: true;
  }>;
};

/**
 * Helper function to configure index behavior with type safety.
 * Uses the generated __queryBuilderIndexes type to provide
 * type checking for index names and columns.
 */
export function indexConfig<
  T extends { Table: TableBase<S> },
  Config extends UserIndexOverrides<T, S>,
  S extends BaseDbDiscriminator,
>(
  entity: T,
  config: Config,
  getQueryBuilderIndexes: () => Promise<{
    queryBuilderIndexes: __queryBuilderIndexes;
  }>
): CompiledIndexesConfig<T, Config, S> {
  const primaryKeyColumns = entity.Table.primaryKey;
  const primaryKeyIndexName = `${entity.Table.tableName}_pkey`;

  // Create the primaryKey index config
  const primaryKeyConfig: CompiledIndexConfigBase<S> = {
    index: {
      name: primaryKeyIndexName,
      table: entity.Table.tableName,
      schema: entity.Table.schema,
      expressions: primaryKeyColumns.map((col) => sql.column({ name: col })),
      unique: true,
      concurrently: false,
      ifNotExists: false,
      nullsNotDistinct: false,
      inverted: false,
      method: undefined,
      ascending: primaryKeyColumns.map(() => true),
      storingColumns: [],
      withClause: undefined,
      storageParameters: undefined,
      operatorClass: undefined,
      whereClause: undefined,
    },
    table: entity.Table,
    Table: entity.Table,
    friendlyIndexName: 'primaryKey',
    getOptions: async () => ({
      columns: Object.fromEntries(
        primaryKeyColumns.map((col) => [col, { operations: ['eq', 'in'] }])
      ),
      minimumSufficientColumns: primaryKeyColumns,
      columnsOrder: primaryKeyColumns,
      strict: { columnsOnly: false },
      predicate: undefined,
      unique: true,
    }),
  };

  const existingIndexes = Object.fromEntries(
    entity.Table.indexes
      ? Object.entries(entity.Table.indexes).map(([key, index]) => {
          return [
            key,
            {
              index,
              table: entity.Table,
              Table: entity.Table,
              friendlyIndexName: key,
              getOptions: async () => {
                const { queryBuilderIndexes } = await getQueryBuilderIndexes();
                const tableIndexes =
                  queryBuilderIndexes[entity.Table.tableName];
                const indexMetadata = tableIndexes[key];
                if (!indexMetadata) {
                  throw new Error(
                    `No metadata found for index ${key} on table ${entity.Table.tableName}`
                  );
                }

                const userConfig =
                  config[key as keyof Config] ||
                  ({} as {
                    columns?: { [ColumnName in string]: IndexColumnConfig };
                    minimumSufficientColumns?: string[];
                    strict?: IndexConfig['strict'];
                  });
                return {
                  columns: Object.fromEntries(
                    Object.entries(indexMetadata.columns).map(([colName]) => [
                      colName,
                      {
                        operations: userConfig.columns?.[colName]
                          ?.operations || ['eq'],
                      },
                    ])
                  ),
                  minimumSufficientColumns:
                    (userConfig.minimumSufficientColumns ? filterUndefined(userConfig.minimumSufficientColumns) : undefined) ||
                    indexMetadata.minimumSufficientColumns,
                  columnsOrder: indexMetadata.columnsOrder,
                  strict: userConfig.strict || { columnsOnly: true },
                  predicate: indexMetadata.predicate,
                  unique: indexMetadata.unique,
                };
              },
            },
          ] as const;
        })
      : []
  );

  return {
    ...existingIndexes,
    primaryKey: primaryKeyConfig,
  } as CompiledIndexesConfig<T, Config, S>;
}
