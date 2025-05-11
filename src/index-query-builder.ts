import {
  type AllOf,
  type AnyOf,
  type Expand,
  type IsAny,
  type TypecheckError,
  filterMap,
} from '@/core-utils';
import type { BaseDbDiscriminator, DataTypeBase, ExpressionBase } from './Base';
import type { DataTypeBoolean, DataTypes, allDataTypes } from './DataType';
import type { ExpressionBuilderShape } from './ExpressionBuilder';
import { serializeValueForDataType } from './InsertBuilder';
import { transformColumnForDataType } from './QueryResult';
import { getAstNodeRepository } from './ast-node-repository';
import {
  type DbConfig,
  type IndexQbWhereOperator,
  type IndexWhereOperators,
  isIndexQbWhereOperator,
} from './db-helper';
import type {
  CompiledIndexConfigBase,
  IndexColumnConfig,
} from './ddl/index-config';
import { managerLocalStorage } from './run-in-transaction';
import { type SqlString, sql } from './sql-string';
import { type TableSelector, createTableSelector } from './table-selector';
import type { TypescriptTypeFromDataType } from './util';

export async function writeSelectFromIndexQuery<
  Base extends CompiledIndexConfigBase<S>,
  S extends BaseDbDiscriminator,
>(
  indexDef: Base,
  state: IndexQueryBuilderParams<Base, S>
): Promise<{
  sqlString: SqlString;
  selectParts: {
    sqlString: SqlString;
    path: string;
    dataType: DataTypeBase;
  }[];
}> {
  const options = await indexDef.getOptions();

  const selectFormat = (() => {
    if (!state.selectFormat) {
      return;
    }
    // if we have an empty selectFormat, we want to select all columns
    // this means that it isn't a strict index
    if (!Object.keys(state.selectFormat).length) {
      return Object.fromEntries(
        Object.entries(indexDef.table.columnSchema).map(([key]) => [
          key,
          (_: any) => _[indexDef.table.defaultAlias][key],
        ])
      );
    }
    return state.selectFormat;
  })();
  // Build SELECT clause
  const selectParts = selectFormat
    ? (() => {
        const parts: {
          sqlString: SqlString;
          path: string;
          dataType: DataTypeBase;
        }[] = [];
        const processSelectField = (
          field: SelectField<Base, S>,
          parentPath: string[] = []
        ) => {
          if (typeof field === 'function') {
            const expr = field(
              createTableSelector([
                {
                  table: indexDef.table,
                  alias: indexDef.table.defaultAlias,
                  isUsingAlias: true,
                },
              ]) as unknown as SelectContext<Base, S>
            );

            parts.push({
              sqlString: getAstNodeRepository(expr._expression).writeSql(
                expr._expression,
                undefined
              ),
              dataType: expr._expression.dataType,
              path: parentPath.join('.'),
            });
          } else if (typeof field === 'object') {
            for (const [key, nestedField] of Object.entries(field)) {
              processSelectField(nestedField, [...parentPath, key]);
            }
          }
        };

        for (const [key, field] of Object.entries(selectFormat)) {
          processSelectField(field, [key]);
        }

        return parts;
      })()
    : Object.entries({
        ...Object.fromEntries(
          indexDef.table.primaryKey.map((val) => [val, {}] as const)
        ),
        ...(options.columns || {}),
      }).map(([key]) => ({
        sqlString: sql.column({
          name: key,
          table: indexDef.table.defaultAlias,
        }),
        path: key,
        dataType: indexDef.table.columnSchema[key].dataType,
      }));

  const selectClause = sql`SELECT ${sql.join(
    selectParts.map((val) => sql`${val.sqlString} AS "${sql([val.path])}"`),
    ', '
  )}`;

  // Build FROM clause
  const fromClause = sql`FROM ${sql.table({
    schema: indexDef.table.schema,
    name: indexDef.table.tableName,
    alias: indexDef.table.defaultAlias,
    index: indexDef.index.name,
  })}`;

  // Build WHERE clause
  const whereConditions: SqlString[] = [];

  // Handle direct conditions
  if (state.conditions) {
    const conditions = filterMap(
      Object.entries(state.conditions),
      ([col, value]) => {
        const column = sql.column({
          name: col,
          table: indexDef.table.defaultAlias,
        });

        // Handle operator objects (lt, lte, gt, gte, not, in)
        if (isIndexQbWhereOperator(value)) {
          const dataType = indexDef.table.columnSchema[col]
            .dataType as (typeof allDataTypes)[number];

          const { baseOperator: op, isNot } = (function handleNotOperator(
            op: IndexQbWhereOperator<unknown>
          ): { baseOperator: IndexQbWhereOperator<unknown>; isNot: boolean } {
            if (op.$operator === 'not') {
              if (!isIndexQbWhereOperator(op.value)) {
                throw new Error(
                  `Invalid NOT operator value: ${JSON.stringify(op.value)} but expected an operator value`
                );
              }
              if (op.value.$operator === 'not') {
                const recursive = handleNotOperator(op.value);
                return {
                  baseOperator: recursive.baseOperator,
                  isNot: !recursive.isNot,
                };
              }

              return {
                baseOperator: op.value,
                isNot: true,
              };
            }
            return {
              baseOperator: op,
              isNot: false,
            };
          })(value);

          const notPrefix = isNot ? sql`NOT ` : sql``;
          if (op.$operator === 'null') {
            return sql`${notPrefix}${column} IS NULL`;
          }

          if (op.$operator === 'between') {
            const {
              value: { min, max, options },
            } = op as ReturnType<IndexWhereOperators<any>['between']>;
            const serializedMin = serializeValueForDataType(col, min, dataType);
            const serializedMax = serializeValueForDataType(col, max, dataType);
            if (!serializedMin || !serializedMax) {
              throw new Error(
                `Invalid BETWEEN operator value: ${JSON.stringify(op.value, undefined, 2)}`
              );
            }
            const minSign =
              (options?.isMinInclusive ?? true) ? sql`<=` : sql`<`;
            // note: maxSign is <= because column is on the left hand side and our max is on the right hand side
            const maxSign =
              (options?.isMaxInclusive ?? true) ? sql`<=` : sql`<`;

            return sql`(${serializedMin} ${minSign} ${column} AND ${column} ${maxSign} ${serializedMax})`;
          }

          // Handle IN operator since it takes an array
          if (op.$operator === 'in') {
            if (!Array.isArray(op.value)) {
              throw new Error(
                `Invalid IN operator value: ${JSON.stringify(op.value)}`
              );
            }
            const values = op.value
              .map((v: unknown) => serializeValueForDataType(col, v, dataType))
              .filter((v): v is SqlString => !!v);
            return sql`${column} IN (${sql.join(values, ', ')})`;
          }

          const serializedValue = serializeValueForDataType(
            col,
            op.$operator === 'null' ? undefined : op.value,
            dataType
          );

          if (!serializedValue) {
            return sql`${notPrefix}${column} IS NULL`;
          }

          const operators: Record<string, string> = {
            lt: '<',
            lte: '<=',
            gt: '>',
            gte: '>=',
            not: '!=',
          };

          const sqlOperator = operators[op.$operator];
          if (!sqlOperator) {
            throw new Error(
              `Invalid operator: ${op.$operator} for column: ${col}`
            );
          }
          return sql`${notPrefix}${column} ${sql([sqlOperator])} ${serializedValue}`;
        }

        // Handle direct equality
        const serialized = serializeValueForDataType(
          col,
          value,
          indexDef.table.columnSchema[col]
            .dataType as (typeof allDataTypes)[number]
        );

        if (serialized) {
          return sql`${column} = ${serialized}`;
        }

        return sql`${column} IS NULL`;
      }
    );

    whereConditions.push(sql.and(conditions));
  }

  // Handle partial index conditions first
  if (options.predicate) {
    whereConditions.push(sql`(${sql([options.predicate])})`);
  }

  // Handle additional conditions
  if (state.additionalConditions) {
    whereConditions.push(
      sql`(${getAstNodeRepository(
        state.additionalConditions._expression
      ).writeSql(state.additionalConditions._expression, undefined)})`
    );
  }

  const whereClause =
    whereConditions.length > 0 ? sql`WHERE ${sql.and(whereConditions)}` : sql``;

  // Build ORDER BY clause
  const orderByClause = (() => {
    if (!state.orderBy) return sql``;

    // Get index expressions from options

    const orderParts = Object.entries(state.orderBy)
      .sort(([a], [b]) => {
        // Convert keys to numbers for numeric comparison
        const numA = Number.parseInt(a, 10);
        const numB = Number.parseInt(b, 10);

        // If both are numbers, compare numerically
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          return numA - numB;
        }
        // If only one is a number, numbers come first
        if (!Number.isNaN(numA)) return -1;
        if (!Number.isNaN(numB)) return 1;
        // For non-numeric keys, maintain original order
        return (
          options.columnsOrder.indexOf(a) - options.columnsOrder.indexOf(b)
        );
      })
      .map(([key, direction]) => {
        // If key is a number, it's complex expression ordering
        const numericKey = Number.parseInt(key, 10);
        if (!Number.isNaN(numericKey)) {
          // Validate index exists
          const indexExpr = options.minimumSufficientColumns[numericKey - 1];
          if (!indexExpr) {
            throw new Error(`Invalid order by index: ${numericKey}`);
          }
          // For complex expressions, we order by the column
          return sql`${sql.column({
            name: indexExpr,
          })} ${sql([direction])}`;
        }

        // Simple column ordering
        return sql`${sql.column({
          name: key,
        })} ${sql([direction])}`;
      });

    if (orderParts.length === 0) return sql``;
    return sql`ORDER BY ${sql.join(orderParts, ', ')}`;
  })();

  // Build LIMIT clause
  const limitClause =
    state.limit !== undefined
      ? sql`LIMIT ${sql.rawNumber(state.limit)}`
      : sql``;

  // Combine all clauses
  return {
    sqlString: sql`${selectClause} ${fromClause} ${whereClause} ${orderByClause} ${limitClause}`,
    selectParts,
  };
}

export function transformIndexQueryBuilderResult(
  row: Record<string, unknown>,
  selectParts: { sqlString: SqlString; path: string; dataType: DataTypeBase }[]
): Record<string, unknown> {
  const result: Record<string, any> = {};
  const dataTypeMap = new Map(
    selectParts.map((part) => [part.path, part.dataType])
  );
  Object.entries(row).forEach(([key, value]) => {
    let head = result;
    const parts = key.split('.');
    for (const part of parts.slice(0, -1)) {
      head[part] = head[part] ?? {};
      head = head[part];
    }
    const dataType = dataTypeMap.get(key);
    head[parts[parts.length - 1]] = dataType
      ? transformColumnForDataType(value, dataType as DataTypes)
      : value;
  });

  return result;
}

export function createIndexQueryBuilder<
  Base extends CompiledIndexConfigBase<S>,
  S extends BaseDbDiscriminator,
>(
  config: {
    discriminator: S;
    query: DbConfig<S, any>['query'];
  },
  indexDef: Base
): IndexQueryBuilder<Base, { base: Base }, S> {
  function createBuilder<P extends IndexQueryBuilderParams<Base, S>>(
    params: P
  ): IndexQueryBuilder<Base, P, S> {
    const builder: IndexQueryBuilder<Base, any, S> = {
      _params: params,

      where(conditions) {
        return createBuilder({
          ...params,
          conditions,
          isAwaitable: true,
        }) as IndexQueryBuilder<Base, any, S>;
      },

      orderBy(config) {
        return createBuilder({
          ...params,
          orderBy: config,
        }) as IndexQueryBuilder<Base, any, S>;
      },

      andWhere(
        expr: (
          value: SelectContext<Base, S>
        ) => ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
      ) {
        return createBuilder({
          ...params,
          additionalConditions: expr(
            createTableSelector([
              {
                table: indexDef.table,
                alias: indexDef.table.defaultAlias,
                isUsingAlias: true,
              },
            ]) as unknown as SelectContext<Base, S>
          ),
        }) as IndexQueryBuilder<Base, any, S>;
      },

      limit(value: number) {
        return createBuilder({ ...params, limit: value }) as IndexQueryBuilder<
          Base,
          any,
          S
        >;
      },

      throwsIfEmpty() {
        return createBuilder({
          ...params,
          throwsIfEmpty: true,
        }) as IndexQueryBuilder<Base, any, S>;
      },

      select(format?: { [key: string]: SelectField<Base, S> }) {
        return createBuilder({
          ...params,
          selectFormat: format ?? {},
        }) as IndexQueryBuilder<Base, any, S>;
      },

      expectOne() {
        return createBuilder({
          ...params,
          throwsIfEmpty: true,
          expectsUniqueResult: true,
        }) as IndexQueryBuilder<Base, any, S>;
      },

      ...(params.isAwaitable && {
        // biome-ignore lint/suspicious/noThenProperty: <explanation>
        then(
          resolve?: ((value: any) => any | PromiseLike<any>) | null,
          reject?: ((reason: unknown) => any | PromiseLike<any>) | null
        ): Promise<void> {
          // Build query
          return writeSelectFromIndexQuery(indexDef, params)
            .then((query) =>
              config
                .query(
                  `index_query:${indexDef.friendlyIndexName}`,
                  query.sqlString,
                  managerLocalStorage.getStore()?.manager
                )
                .then((res) => ({
                  rawResults: res,
                  query,
                }))
            )
            .then(({ rawResults, query }) => {
              const processedResults = (() => {
                // Apply limit if specified
                const limitedResults =
                  params.limit !== undefined
                    ? rawResults.slice(0, params.limit)
                    : rawResults;

                // Handle empty results
                if (limitedResults.length === 0 && params.throwsIfEmpty) {
                  throw new Error('No results found');
                }

                // Handle unique result expectation
                if (params.expectsUniqueResult && limitedResults.length > 1) {
                  throw new Error(
                    'Multiple results found when expecting unique result'
                  );
                }

                // Transform results based on select format
                return limitedResults.map((row) =>
                  transformIndexQueryBuilderResult(row, query.selectParts)
                );
              })();

              return resolve?.(processedResults);
            })
            .catch(reject);
        },
      }),
    };

    return builder as unknown as IndexQueryBuilder<Base, P, S>;
  }

  return createBuilder({ base: indexDef });
}

type RequiredColumnsForIndex<
  Base extends CompiledIndexConfigBase<S>,
  S extends BaseDbDiscriminator,
> = Base extends {
  getOptions: () => Promise<{
    minimumSufficientColumns: infer C extends readonly string[];
  }>;
}
  ? C[number]
  : never;

type OrderDirection = 'asc' | 'desc';

// For simple column ordering or complex index expressions
type OrderByConfig =
  | Record<string, OrderDirection>
  | {
      [K in 1 | 2 | 3 | 4 | 5]?: OrderDirection;
    };

interface IndexQueryBuilderParams<
  Base extends CompiledIndexConfigBase<S>,
  S extends BaseDbDiscriminator,
> {
  base: Base;
  isAwaitable?: boolean | undefined;
  expectsUniqueResult?: boolean | undefined;
  throwsIfEmpty?: boolean | undefined;
  limit?: number | undefined;
  selectFormat?: { [key: string]: SelectField<Base, S> } | undefined;
  conditions?: Record<string, unknown>;
  additionalConditions?: ExpressionBuilderShape<
    ExpressionBase<DataTypeBoolean>
  >;
  orderBy?: OrderByConfig;
}

type WithIndexWhereOperator<T> =
  | NonNullable<T>
  | ReturnType<IndexWhereOperators<T>[keyof IndexWhereOperators<T>]>;

/**
 * Base query builder interface that extends Promise
 */
export type IndexQueryBuilder<
  Base extends CompiledIndexConfigBase<S>,
  Params extends IndexQueryBuilderParams<Base, S>,
  S extends BaseDbDiscriminator,
> = ThenableResult<Base, Params, S> & {
  /**
   * Get debug information about the query
   */
  _params: Params;

  where(
    conditions: IndexColumns<Base> extends infer ColumnsConfig extends {
      [Key in keyof Base['table']['columnSchema']]?: IndexColumnConfig;
    }
      ? Expand<
          {
            [Key in Exclude<
              keyof ColumnsConfig,
              RequiredColumnsForIndex<Base, S>
            >]?: Key extends keyof Base['table']['columnSchema']
              ? WithIndexWhereOperator<
                  TypescriptTypeFromDataType<
                    Base['table']['columnSchema'][Key]['dataType']
                  >
                >
              : never;
          } & {
            [Key in RequiredColumnsForIndex<
              Base,
              S
            >]: Key extends keyof Base['table']['columnSchema']
              ? WithIndexWhereOperator<
                  TypescriptTypeFromDataType<
                    Base['table']['columnSchema'][Key]['dataType']
                  >
                >
              : never;
          }
        >
      : never
  ): IndexQueryBuilder<
    Base,
    SetParams<Base, Params, { isAwaitable: true }, S>,
    S
  >;

  /**
   * Add additional where conditions using expression builder.
   * Only available for non-strict indexes.
   * @example
   * ```typescript
   * .where({ id: '123' })
   * .andWhere(expr => expr.column('status').eq('active'))
   * ```
   */
  andWhere: AnyOf<
    [
      AllOf<
        [
          CanCustomSelect<Base, S> extends true ? true : false,
          Params['isAwaitable'] extends true ? true : false,
        ]
      >,
      IsAny<Params>,
    ]
  > extends true
    ? (
        builder: (
          value: TableSelector<
            readonly [
              {
                table: Base['table'];
                alias: Base['table']['defaultAlias'];
                isUsingAlias: true;
              },
            ],
            S
          >
        ) => ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
      ) => IndexQueryBuilder<Base, Params, S>
    : TypecheckError<'Cannot use andWhere on a strict index', Base>;

  /**
   * Get a single result, or undefined if none found
   */
  limit<Value extends number>(
    limit: Value
  ): IndexQueryBuilder<Base, SetParams<Base, Params, { limit: Value }, S>, S>;

  throwsIfEmpty(): IndexQueryBuilder<
    Base,
    SetParams<Base, Params, { throwsIfEmpty: true }, S>,
    S
  >;

  select: AnyOf<
    [CanCustomSelect<Base, S> extends true ? true : false, IsAny<Params>]
  > extends true
    ? <Format extends { [key: string]: SelectField<Base, S> }>(
        format?: Format
      ) => IndexQueryBuilder<
        Base,
        SetParams<
          Base,
          Params,
          {
            selectFormat: { [Key: string]: SelectField<Base, S> } extends Format
              ? {
                  [Key in keyof Base['table']['columnSchema']]: () => ExpressionBuilderShape<
                    ExpressionBase<
                      Base['table']['columnSchema'][Key]['dataType']
                    >
                  >;
                }
              : Format;
          },
          S
        >,
        S
      >
    : TypecheckError<'Cannot use select on a strict index', Base>;

  /**
   * Expect exactly one result, throw if not found
   */
  expectOne(): IndexQueryBuilder<
    Base,
    SetParams<
      Base,
      Params,
      { throwsIfEmpty: true; expectsUniqueResult: true },
      S
    >,
    S
  >;

  /**
   * Add ORDER BY clause. Must follow index column order.
   * For simple indexes, use column names:
   * ```typescript
   * .orderBy({ column_a: 'asc', column_b: 'desc' })
   * ```
   *
   * For complex index expressions, use numeric indices:
   * ```typescript
   * .orderBy({ 1: 'asc', 2: 'desc' })
   * ```
   */
  orderBy(
    config: ProgressiveRecord<
      Awaited<ReturnType<Base['getOptions']>>['columnsOrder'],
      'desc' | 'asc'
    >
  ): IndexQueryBuilder<
    Base,
    SetParams<Base, Params, { orderBy: OrderByConfig }, S>,
    S
  >;
};

type ProgressiveRecord<
  T extends readonly (number | string)[],
  U,
> = T extends readonly [
  infer First extends number | string,
  ...infer Rest extends (number | string)[],
]
  ? Expand<
      | ({ [K in First]: U } & {
          [K in Rest[number]]?: U;
        })
      | (ProgressiveRecord<Rest, U> & { [K in First]: U })
    >
  : never;

type SetParams<
  Base extends CompiledIndexConfigBase<S>,
  Params extends IndexQueryBuilderParams<Base, S>,
  Update extends Partial<IndexQueryBuilderParams<Base, S>>,
  S extends BaseDbDiscriminator,
> = IsAny<Params> extends true
  ? Params
  : Omit<Params, keyof Update> & Update extends infer U extends
        IndexQueryBuilderParams<Base, S>
    ? Expand<U>
    : never;

/**
 * Represents the Promise-like result type for index queries.
 *
 * Type Resolution Process:
 * 1. First checks if query is awaitable (isAwaitable: true)
 *    If false -> returns {} (query building stage)
 *
 * 2. Then checks if custom select is allowed (CanCustomSelect: true)
 *    If true -> checks for selectFormat
 *    If false -> uses IndexSelectColumns
 *
 * 3. For custom select (selectFormat present):
 *    - Unique result (expectsUniqueResult: true):
 *      Type: PromiseLike<SelectResult<Format> | undefined>
 *    - Multiple results:
 *      Type: PromiseLike<SelectResult<Format>[]>
 *
 * 4. For default select:
 *    - Unique result (expectsUniqueResult: true):
 *      Type: PromiseLike<IndexSelectColumns<Base> | undefined>
 *    - Multiple results:
 *      Type: PromiseLike<IndexSelectColumns<Base>[]>
 *
 * Examples:
 * ```typescript
 * // Query building (not awaitable)
 * const query = db.selectFromIndex(...)  // Type: {}
 *
 * // Custom select, unique result
 * const single = await query
 *   .select({ id: _ => _.id })
 *   .expectOne()  // Type: { id: string } | undefined
 *
 * // Custom select, multiple results
 * const many = await query
 *   .select({
 *     id: _ => _.id,
 *     nested: { value: _ => _.columnB }
 *   })  // Type: Array<{ id: string, nested: { value: string } }>
 *
 * // Default select, unique result
 * const one = await query
 *   .expectOne()  // Type: IndexSelectColumns<Base> | undefined
 *
 * // Default select, multiple results
 * const all = await query  // Type: Array<IndexSelectColumns<Base>>
 * ```
 *
 * @template Base - The index configuration type
 * @template Params - The query builder parameters
 * @template S - The database discriminator type
 */
type ThenableResult<
  Base extends CompiledIndexConfigBase<S>,
  Params extends IndexQueryBuilderParams<Base, S>,
  S extends BaseDbDiscriminator,
> = Params['isAwaitable'] extends true
  ? AnyOf<
      [
        IsAny<Params>,
        AllOf<
          [
            CanCustomSelect<Base, S> extends true ? true : false,
            NonNullable<Params['selectFormat']> extends Params['selectFormat']
              ? true
              : false,
          ]
        >,
      ]
    > extends true
    ? Params extends { selectFormat: infer F }
      ? AnyOf<
          [
            Params['expectsUniqueResult'] extends true ? true : false,
            Params['limit'] extends 1 ? true : false,
          ]
        > extends true
        ? PromiseLike<
            [
              | Expand<SelectResult<F>>
              | (Params['throwsIfEmpty'] extends true ? never : undefined),
            ]
          >
        : PromiseLike<Expand<SelectResult<F>>[]>
      : AnyOf<
            [
              Params['expectsUniqueResult'] extends true ? true : false,
              Params['limit'] extends 1 ? true : false,
            ]
          > extends true
        ? PromiseLike<
            [
              | Expand<IndexSelectColumns<Base>>
              | (Params['throwsIfEmpty'] extends true ? never : undefined),
            ]
          >
        : PromiseLike<Expand<IndexSelectColumns<Base>>[]>
    : AnyOf<
          [
            Params['expectsUniqueResult'] extends true ? true : false,
            Params['limit'] extends 1 ? true : false,
          ]
        > extends true
      ? PromiseLike<
          [
            | Expand<IndexSelectColumns<Base>>
            | (Params['throwsIfEmpty'] extends true ? never : undefined),
          ]
        >
      : PromiseLike<Expand<IndexSelectColumns<Base>>[]>
  : {};

type CanCustomSelect<
  Base extends CompiledIndexConfigBase<S>,
  S extends BaseDbDiscriminator,
> = Base extends {
  getOptions: () => Promise<{
    strict: {
      columnsOnly: true;
    };
  }>;
}
  ? false
  : true;

type SelectContext<
  T extends CompiledIndexConfigBase<S>,
  S extends BaseDbDiscriminator,
> = TableSelector<
  readonly [
    {
      table: T['table'];
      alias: T['table']['defaultAlias'];
      isUsingAlias: true;
    },
  ],
  S
>;

type SelectField<
  T extends CompiledIndexConfigBase<S>,
  S extends BaseDbDiscriminator,
> =
  | ((
      ctx: SelectContext<T, S>
    ) => ExpressionBuilderShape<ExpressionBase<DataTypeBase>>)
  | { [key: string]: SelectField<T, S> };

type SelectResult<
  T,
  Context = SelectContext<
    CompiledIndexConfigBase<BaseDbDiscriminator>,
    BaseDbDiscriminator
  >,
> = T extends (
  ctx: Context
) => ExpressionBuilderShape<ExpressionBase<infer DataType>>
  ? TypescriptTypeFromDataType<DataType>
  : T extends Record<string, SelectField<infer Base, infer S>>
    ? { [K in keyof T]: SelectResult<T[K], SelectContext<Base, S>> }
    : never;

/**
 * Type helper to extract column names from an index config
 */
export type IndexColumns<T extends CompiledIndexConfigBase<any>> = T extends {
  getOptions: () => Promise<{
    columns?: infer C extends {
      [Key in keyof T['table']['columnSchema']]?: IndexColumnConfig;
    };
  }>;
}
  ? C
  : never;

/**
 * Type helper to check if an index is unique
 */
export type IsUniqueIndex<T extends CompiledIndexConfigBase<any>> = T extends {
  index: { unique: true };
}
  ? true
  : false;

type IndexSelectColumns<T extends CompiledIndexConfigBase<any>> = {
  [Key in keyof IndexColumns<T>]: Key extends keyof T['table']['columnSchema']
    ? TypescriptTypeFromDataType<T['table']['columnSchema'][Key]['dataType']>
    : never;
} & {
  [Key in T['table']['primaryKey'][number]]: Key extends keyof T['table']['columnSchema']
    ? TypescriptTypeFromDataType<T['table']['columnSchema'][Key]['dataType']>
    : never;
};
