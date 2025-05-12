import type {
  AllOf,
  AnyOf,
  Expand,
  IsAny,
  OriginalReferenceableObject,
  TypecheckError,
} from '@/core-utils';
import { getAstNodeRepository } from './ast-node-repository';
import type { BaseDbDiscriminator, TableBase, TableColumnBase } from './base';
import type { DbConfig } from './db-helper';
import { createIndexBuilder } from './ddl/index-builder';
import type {
  ExtractNameFromIndexDefinition,
  IndexConfig,
  IndexDefinition,
} from './ddl/index-builder/index-definition';
import type { DdlIndexDefinition } from './ddl/table';
import { createExpressionBuilder } from './expression-builder';
import { expressionColumn } from './expressions/expression-column';
import {
  type TableColumnBuilder,
  type TableColumnBuilderInferrer,
  createTableColumnInferrer,
} from './table-from-schema-column-builder';

export function buildTableFromSchemaBase<Schema, S extends BaseDbDiscriminator>(
  config: DbConfig<S, any>,
  inheritedBase?: TableBase<S>
) {
  const base: TableBase<S> = inheritedBase ?? {
    class: 'table',
    type: 'table',
    columnSchema: {},
    tableName: '',
    schema: config.defaultSchema ?? 'public',
    variant: 'table',
    defaultAlias: '',
    primaryKey: [],
    $getSchema: () => {
      throw new Error('This should not be called in runtime');
    },
    indexes: undefined,
    _internalIndexes: undefined,
    _databaseType: config.discriminator,
  };

  const builder: TableFromSchemaBuilder<Schema, any, S> = {
    tableName: (tableName) => {
      return buildTableFromSchemaBase(config, {
        ...base,
        tableName,
      });
    },
    schema: (schema) => {
      return buildTableFromSchemaBase(config, {
        ...base,
        schema,
      });
    },
    primaryKey: (...keys) => {
      return buildTableFromSchemaBase(config, {
        ...base,
        primaryKey: keys,
      });
    },
    columns: (params) => {
      const columns = Object.fromEntries(
        Object.entries(params).map(([paramKey, value]) => {
          const fn = value as (typeof params)[keyof typeof params];

          const columnBase = fn(createTableColumnInferrer(paramKey));

          return [paramKey, columnBase.getColumn()];
        })
      );

      const res = buildTableFromSchemaBase<Schema, S>(config, {
        ...base,
        columnSchema: columns,
      });

      return res;
    },
    build() {
      const { _internalIndexes } = base;

      const namedIndexes = _internalIndexes
        ? Object.fromEntries(
            Object.entries(_internalIndexes).map(
              ([key, index]): [string, DdlIndexDefinition] => [
                key,
                {
                  // Required fields
                  name: index._properties.name ?? `${base.tableName}_${key}`,
                  table: base.tableName,
                  schema: base.schema,
                  expressions: index._properties.expressions.map((expr) =>
                    'getQuery' in expr
                      ? expr
                      : getAstNodeRepository(expr).writeSql(expr, undefined)
                  ),

                  // Fields with defaults
                  unique: index._properties.options.unique ?? false,
                  concurrently: false, // Default to false for safety
                  ifNotExists: false, // Default to false for safety
                  nullsNotDistinct: false, // Default to false for standard behavior

                  // Optional fields
                  method: index._properties.options.method,
                  ascending: undefined, // Will be determined by the expressions
                  storingColumns:
                    index._properties.storingColumns?.map((col) => col.value) ??
                    [],
                  whereClause: index._properties.condition,
                  withClause: undefined,
                  storageParameters: undefined,
                  previousState: undefined, // Will be populated when tracking changes
                },
              ]
            )
          )
        : undefined;

      return {
        ...base,
        indexes: namedIndexes,
      };
    },
    defaultAlias(alias) {
      return buildTableFromSchemaBase(config, {
        ...base,
        defaultAlias: alias,
      });
    },
    indexes(configFn) {
      // Create the indexes using the config function
      const indexes = configFn({
        table: Object.fromEntries(
          Object.entries(base.columnSchema).map(([key]) => [
            key,
            createExpressionBuilder(
              expressionColumn.create(
                {
                  table: base,
                  alias: base.defaultAlias,
                  isUsingAlias: false,
                },
                key
              )
            ),
          ])
        ),
        index: (...expressions) => {
          return createIndexBuilder<TableBase<S>, S>(expressions);
        },
      });

      return buildTableFromSchemaBase(config, {
        ...base,
        _internalIndexes: indexes,
      });
    },
    introspect(options) {
      return buildTableFromSchemaBase(config, {
        ...base,
        introspection: {
          columns: options?.columns ?? 'enforce',
          constraints: options?.constraints ?? 'ignore',
          indexes: options?.indexes ?? 'enforce',
          indexSyncMode: options?.indexSyncMode ?? 'full',
          ignoreIndexes: options?.ignoreIndexes ?? [],
          ignoreColumns: options?.ignoreColumns ?? [],
        },
      });
    },
  };
  return builder;
}

export type ApplyIndexNamesToTable<
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
> = undefined extends Table['_internalIndexes']
  ? Table
  : Expand<
      Omit<Table, 'indexes'> & {
        indexes: {
          [Key in keyof Table['_internalIndexes']]: DdlIndexDefinition<
            ExtractNameFromIndexDefinition<
              Table['tableName'],
              Key & string,
              Table['_internalIndexes'][Key] extends infer O extends
                IndexDefinition<any, any>
                ? O
                : never
            >
          >;
        };
      }
    >;

export interface TableFromSchemaBuilder<
  Schema,
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
> {
  build: AnyOf<
    [
      IsAny<Table>,
      AllOf<
        [
          string extends Table['tableName'] ? false : true,
          [Table['defaultAlias']] extends [never] ? false : true,
          [Table['primaryKey']] extends [never] ? false : true,
        ]
      >,
    ]
  > extends true
    ? () => ApplyIndexNamesToTable<Table, S>
    : TypecheckError<
        `You must specify a tableName, defaultAlias, columns, and a primaryKey`,
        {}
      >;
  tableName<T extends string>(
    name: T
  ): TableFromSchemaBuilder<
    Schema,
    SetTableBuilderParams<
      Table,
      {
        tableName: T;
      },
      S
    >,
    S
  >;
  schema<T extends string>(
    schema: T
  ): TableFromSchemaBuilder<
    Schema,
    SetTableBuilderParams<
      Table,
      {
        schema: T;
      },
      S
    >,
    S
  >;
  primaryKey<
    T extends [
      Extract<keyof Schema, string>,
      ...Extract<keyof Schema, string>[],
    ],
  >(
    ...keys: T
  ): TableFromSchemaBuilder<
    Schema,
    SetTableBuilderParams<
      Table,
      {
        primaryKey: T;
      },
      S
    >,
    S
  >;
  defaultAlias<Alias extends string>(
    alias: Alias
  ): TableFromSchemaBuilder<
    Schema,
    SetTableBuilderParams<Table, { defaultAlias: Alias }, S>,
    S
  >;
  columns: <
    Columns extends {
      [Key in Extract<
        keyof Schema,
        string
      >]: TableColumnBuilder<TableColumnBase>;
    },
    Params extends {
      [Key in Extract<keyof Schema, string>]: (
        qb: TableColumnBuilderInferrer<Schema[Key], Key>
      ) => Columns[Key];
    },
  >(
    params: Params
  ) => TableFromSchemaBuilder<
    Schema,
    SetTableBuilderParams<
      Table,
      {
        columnSchema: OriginalReferenceableObject<
          {
            [Key in keyof Params]: ReturnType<
              Params[Key]
            > extends TableColumnBuilder<infer U extends TableColumnBase>
              ? U
              : never;
          },
          Schema
        >;
      },
      S
    >,
    S
  >;

  indexes: AnyOf<
    [
      IsAny<Table>,
      AllOf<
        [
          string extends Table['tableName'] ? false : true,
          [Table['defaultAlias']] extends [never] ? false : true,
          [Table['primaryKey']] extends [never] ? false : true,
        ]
      >,
    ]
  > extends true
    ? <const T extends { [Key in string]: IndexDefinition<Table, S> }>(
        configFn: (config: IndexConfig<Table, S>) => T
      ) => TableFromSchemaBuilder<
        Schema,
        SetTableBuilderParams<
          Table,
          {
            _internalIndexes: T;
          },
          S
        >,
        S
      >
    : TypecheckError<
        `You must specify a tableName, defaultAlias, columns, and a primaryKey`,
        {}
      >;

  /**
   * Configure introspection settings for this table
   */
  introspect(options?: Partial<TableIntrospectOptions>): TableFromSchemaBuilder<
    Schema,
    SetTableBuilderParams<
      Table,
      {
        introspection: TableIntrospectOptions;
      },
      S
    >,
    S
  >;
}

export type EnforcementLevel = 'enforce' | 'warn' | 'ignore';

export interface TableIntrospectOptions {
  columns: EnforcementLevel;
  indexes: EnforcementLevel;
  constraints: EnforcementLevel;
  ignoreIndexes: RegExp[];
  ignoreColumns: RegExp[];
  /**
   * Controls how index differences are handled:
   * - 'additive': Only add new indexes, don't remove existing ones
   * - 'full': Add new indexes and remove ones not in schema (default)
   */
  indexSyncMode: 'additive' | 'full';
}

type SetTableBuilderParams<
  Params extends TableBase<S>,
  Update extends Partial<TableBase<S>>,
  S extends BaseDbDiscriminator,
> = IsAny<Params> extends true
  ? Params
  : Omit<Params, keyof Update> & Update extends infer U extends TableBase<S>
    ? Expand<U>
    : never;

/**
 * Helper function to check if a table should be introspected based on its settings
 */
export function shouldIntrospectSchema<S extends BaseDbDiscriminator>(
  table: TableBase<S>
): boolean {
  if (!table.introspection) {
    return false;
  }

  // Check if any introspection level is set to 'enforce'
  return (
    table.introspection.columns === 'enforce' ||
    table.introspection.indexes === 'enforce' ||
    table.introspection.constraints === 'enforce'
  );
}

/**
 * Helper function to check if indexes should be introspected for a table
 */
export function shouldIntrospectIndexes<S extends BaseDbDiscriminator>(
  table: TableBase<S>
): boolean {
  if (!table.introspection) return false;
  return (
    !table.introspection.indexes || table.introspection.indexes !== 'ignore'
  );
}

/**
 * Helper function to check if columns should be introspected for a table
 */
export function shouldIntrospectColumns<S extends BaseDbDiscriminator>(
  table: TableBase<S>
): boolean {
  return table.introspection?.columns === 'enforce';
}

/**
 * Helper function to check if constraints should be introspected for a table
 */
export function shouldIntrospectConstraints<S extends BaseDbDiscriminator>(
  table: TableBase<S>
): boolean {
  return table.introspection?.constraints === 'enforce';
}
