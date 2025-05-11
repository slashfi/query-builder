import type { BaseDbDiscriminator, TableBase } from './Base';
import { createInsert } from './InsertBuilder';
import { createUpdate } from './UpdateBuilder';
import type { __queryBuilderIndexes } from './ddl/codegen/index-metadata';
import {
  type CompiledIndexConfigBase,
  type CompiledIndexesConfig,
  type UserIndexOverrides,
  indexConfig,
} from './ddl/index-config';
import { createFrom } from './from-builder';
import {
  type IndexQueryBuilder,
  createIndexQueryBuilder,
} from './index-query-builder';
import { createTransaction, managerLocalStorage } from './run-in-transaction';
import type { SqlString } from './sql-string';
import {
  type TableFromSchemaBuilder,
  buildTableFromSchemaBase,
} from './table-from-schema-builder';
import { type ValuesTableBuilder, createValuesBuilder } from './values-builder';

export function createDbDiscriminator<Name extends string>(name: Name) {
  return Object.assign(Symbol(name), {
    _db: name,
  });
}

export interface DbConfig<S extends BaseDbDiscriminator, Manager> {
  discriminator: S;
  defaultSchema?: string;
  /**
   * Function to execute SQL queries
   */
  query: (
    queryName: string,
    sql: SqlString,
    manager?: Manager
  ) => Promise<Record<string, any>[]>;
  /**
   * Function to start a transaction
   */
  runQueriesInTransaction?: (
    runQueries: (manager: NoInfer<Manager>) => Promise<void>
  ) => Promise<void>;
  /**
   * Generated index metadata
   */
  getQueryBuilderIndexes: () => Promise<{
    queryBuilderIndexes: __queryBuilderIndexes;
  }>;
}

// Type to ensure tables match their db instance type
type DbTableBase<S extends BaseDbDiscriminator> = TableBase<S>;

export interface IndexQbWhereOperator<T> {
  $operator: string;
  value: T;
}

export function isIndexQbWhereOperator(
  value: unknown
): value is IndexQbWhereOperator<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$operator' in value &&
    'value' in value &&
    typeof value.$operator === 'string' &&
    value.$operator in indexWhereOperators()
  );
}

export const baseWhereOperators = <Base>() => ({
  in: <T extends Array<Base>>(values: T) => ({
    $operator: 'in' as const,
    value: values,
  }),
  lt: <T extends Base>(value: T) => ({ $operator: 'lt' as const, value }),
  lte: <T extends Base>(value: T) => ({ $operator: 'lte' as const, value }),
  gt: <T extends Base>(value: T) => ({ $operator: 'gt' as const, value }),
  gte: <T extends Base>(value: T) => ({ $operator: 'gte' as const, value }),
  between: <T extends Base>(
    min: T,
    max: T,
    options?: { isMinInclusive?: boolean; isMaxInclusive?: boolean }
  ) => ({
    $operator: 'between' as const,
    value: {
      min,
      max,
      options: {
        isMinInclusive: options?.isMinInclusive ?? true,
        isMaxInclusive: options?.isMaxInclusive ?? true,
      },
    },
  }),
  null: () => ({ $operator: 'null' as const, value: null }),
});

export const metaOperators = <Base>() => ({
  not: <
    Value extends
      | ReturnType<
          ReturnType<typeof baseWhereOperators<Base>>[keyof ReturnType<
            typeof baseWhereOperators<Base>
          >]
        >
      | { $operator: 'not'; value: Value },
  >(
    value: Value
  ) => ({
    $operator: 'not' as const,
    value,
  }),
});

export const indexWhereOperators = <Base>() => ({
  ...baseWhereOperators<Base>(),
  ...metaOperators<Base>(),
});

export interface IndexWhereOperators<T>
  extends ReturnType<typeof indexWhereOperators<T>> {}

export interface Db<S extends BaseDbDiscriminator>
  extends IndexWhereOperators<any> {
  /**
   * Register an entity with the database
   */
  register: <Entity extends { Table: DbTableBase<S> }>(entity: Entity) => void;

  /**
   * Build a table schema and register it with the database
   */
  buildTableFromSchema<Schema>(): TableFromSchemaBuilder<
    Schema,
    {
      class: 'table';
      type: 'table';
      columnSchema: {};
      tableName: string;
      schema: string;
      variant: 'table';
      customIndex: string | undefined;
      defaultAlias: never;
      primaryKey: never;
      $getSchema: () => Schema;
      indexes: undefined;
      _internalIndexes: undefined;
      _databaseType: S;
    },
    S
  >;

  /**
   * Start a FROM query for a registered entity
   */
  from: ReturnType<typeof createFrom<S>>;

  /**
   * Start an INSERT query for a registered entity
   */
  insert: ReturnType<typeof createInsert<S>>;

  /**
   * Start an UPDATE query for a registered entity
   */
  update: ReturnType<typeof createUpdate<S>>;

  /**
   * Start a transaction
   */
  transaction: ReturnType<typeof createTransaction<S>>;

  /**
   * Add a side effect to be run after a transaction is committed
   * Throws if called outside of a transaction context
   */
  addTransactionSideEffect: (fn: () => Promise<void>) => void;

  /**
   * Get all registered entities
   */
  getEntities: () => ReadonlyMap<string, DbTableBase<S>>;

  /**
   * Check if an entity is registered
   */
  hasEntity: (tableName: string, schema?: string) => boolean;

  /**
   * Get a registered entity by table name
   */
  getEntity: (tableName: string, schema?: string) => DbTableBase<S> | undefined;

  /**
   * Remove all registered entities
   */
  clearEntities: () => void;

  /**
   * Query using a table index with type safety
   */
  selectFromIndex: <Base extends CompiledIndexConfigBase<S>>(
    indexDef: Base
  ) => IndexQueryBuilder<Base, { base: Base }, S>;

  indexConfig<
    T extends { Table: TableBase<S> },
    Config extends UserIndexOverrides<T, S>,
  >(entity: T, config: Config): CompiledIndexesConfig<T, Config, S>;

  values: ValuesTableBuilder<
    {
      values: undefined;
      dataTypeConstraints: {};
      discriminator: S;
    },
    S
  >['withDataTypes'];
}

/**
 * Create a new database instance with a unique symbol type
 */
export function createDb<Manager, const S extends BaseDbDiscriminator>(
  config: DbConfig<S, Manager>
): Db<S> {
  // Internal state
  const entities = new Map<string, DbTableBase<S>>();

  // Create query builders
  const fromBuilder = createFrom(config);
  const insertBuilder = createInsert(config);
  const updateBuilder = createUpdate(config);

  // Helper to get entity key
  const getEntityKey = (tableName: string, schema = config.defaultSchema) =>
    `${schema}.${tableName}`;

  // Return the database interface
  return {
    ...indexWhereOperators(),
    register: (entity) => {
      const key = getEntityKey(entity.Table.tableName, entity.Table.schema);
      if (entities.has(key)) {
        throw new Error(
          `Entity with table name "${key}" is already registered`
        );
      }
      entities.set(key, entity.Table);
    },

    buildTableFromSchema: () => buildTableFromSchemaBase(config),

    from: fromBuilder,

    insert: insertBuilder,

    update: updateBuilder,

    transaction: createTransaction(config),

    addTransactionSideEffect: (fn) => {
      const localStore = managerLocalStorage.getStore();
      if (!localStore) {
        throw new Error(
          'addTransactionSideEffect called outside of a transaction context'
        );
      }

      localStore.sideEffects.push(fn);
    },

    getEntities: () => entities,

    hasEntity: (tableName, schema = config.defaultSchema) =>
      entities.has(getEntityKey(tableName, schema)),

    getEntity: (tableName, schema = config.defaultSchema) =>
      entities.get(getEntityKey(tableName, schema)),

    clearEntities: () => entities.clear(),

    selectFromIndex: (...args) =>
      createIndexQueryBuilder(
        {
          discriminator: config.discriminator,
          query: config.query,
        },
        ...args
      ),

    indexConfig: (entity, cfg) =>
      indexConfig(entity, cfg, config.getQueryBuilderIndexes),

    values: createValuesBuilder<
      {
        values: undefined;
        dataTypeConstraints: {};
        discriminator: S;
      },
      S
    >({
      values: undefined,
      dataTypeConstraints: {},
      discriminator: config.discriminator,
    }).withDataTypes,
  };
}
