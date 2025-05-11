import {
  type AllOf,
  type AnyOf,
  type Expand,
  type IsAny,
  type Not,
  assertUnreachable,
} from '@/core-utils';
import type {
  BaseDbDiscriminator,
  DataTypeBase,
  ExpressionBase,
  TableBase,
} from './Base';
import {
  type DataTypeBoolean,
  type DataTypes,
  type allDataTypes,
  getNonNullableDataType,
  isDataTypeNullable,
} from './DataType';
import type { GenericEntityTarget } from './EntityTarget';
import type {
  CompositeSelectionBuilder,
  ExpressionBuilderShape,
} from './ExpressionBuilder';
import type { TargetBase } from './FromBuilder';
import { transformColumnForDataType } from './QueryResult';
import { getAstNodeRepository } from './ast-node-repository';
import type { DbConfig } from './db-helper';
import {
  type ExpressionColumn,
  expressionColumn,
} from './expressions/ExpressionColumn';
import { managerLocalStorage } from './run-in-transaction';
import { type SqlString, sql } from './sql-string';
import { type TableSelector, createTableSelector } from './table-selector';
import type { TypescriptTypeFromDataType } from './util';

type InsertableValues<
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
> = Expand<
  {
    [Key in keyof Table['columnSchema'] as Table['columnSchema'][Key]['isOptionalForInsert'] extends true
      ? never
      : Key]: TypescriptTypeFromDataType<
      Table['columnSchema'][Key]['dataType']
    >;
  } & {
    [Key in keyof Table['columnSchema'] as Table['columnSchema'][Key]['isOptionalForInsert'] extends true
      ? Key
      : never]?: TypescriptTypeFromDataType<
      Table['columnSchema'][Key]['dataType']
    >;
  }
>;

type TableRecord<
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
> = Expand<{
  [Key in keyof Table['columnSchema']]: TypescriptTypeFromDataType<
    Table['columnSchema'][Key]['dataType']
  >;
}>;

interface InsertParams<S extends BaseDbDiscriminator> {
  target: TargetBase<S>;
  values:
    | InsertableValues<TableBase<S>, S>
    | ReadonlyArray<InsertableValues<TableBase<S>, S>>
    | InsertableValues<TableBase<S>, S>[]
    | undefined;
  onConflict:
    | undefined
    | (
        | {
            columns: ReadonlyArray<ExpressionColumn<TargetBase<S>, string, S>>;
            doNothing: true;
          }
        | {
            columns: ReadonlyArray<ExpressionColumn<TargetBase<S>, string, S>>;
            doUpdateSet: {
              [Key in keyof TableBase<S>['columnSchema']]?:
                | TypescriptTypeFromDataType<
                    TableBase<S>['columnSchema'][Key]['dataType']
                  >
                | TableSelector<
                    [
                      {
                        table: TableBase<S>;
                        alias: string;
                        isUsingAlias: true;
                      },
                      {
                        table: TableBase<S>;
                        alias: 'excluded';
                        join: { type: 'insert' };
                        isUsingAlias: true;
                      },
                    ],
                    S
                  >;
            };
            where?: ExpressionBase<DataTypeBoolean>;
          }
      );
  returning:
    | '*'
    | ReadonlyArray<ExpressionBuilderShape<ExpressionBase<any>>>
    | undefined;
  queryName: string | undefined;
}

type SetParams<
  Params extends InsertParams<S>,
  Update extends Partial<InsertParams<S>>,
  S extends BaseDbDiscriminator,
> = IsAny<Params> extends true
  ? Params
  : Omit<Params, keyof Update> & Update extends infer U extends InsertParams<S>
    ? Expand<U>
    : never;

type CanValue<
  Params extends InsertParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<[IsAny<Params>, undefined extends Params['values'] ? true : false]>;

type CanConflict<
  Params extends InsertParams<S>,
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    IsAny<Params>,
    AllOf<
      [
        undefined extends Params['onConflict'] ? true : false,
        Not<CanValue<Params, S>>,
      ]
    >,
  ]
>;

export interface InsertBuilder<
  Params extends InsertParams<S>,
  S extends BaseDbDiscriminator,
> {
  setQueryName: (
    queryName: string
  ) => InsertBuilder<SetParams<Params, { queryName: string }, S>, S>;
  values: CanValue<Params, S> extends true
    ? <
        Entities extends
          | InsertableValues<Params['target']['table'], S>
          | ReadonlyArray<InsertableValues<Params['target']['table'], S>>
          | InsertableValues<Params['target']['table'], S>[],
      >(
        params: Entities
      ) => InsertBuilder<SetParams<Params, { values: Entities }, S>, S>
    : never;

  onConflict: CanConflict<Params, S> extends true
    ? OnConflict<Params, S>
    : never;
  returning(
    items: '*'
  ): InsertBuilder<SetParams<Params, { returning: '*' }, S>, S>;
  returning<
    Items extends ReadonlyArray<ExpressionBuilderShape<ExpressionBase<any>>>,
  >(
    fn: (
      selector: IsAny<Params> extends true
        ? CompositeSelectionBuilder<TargetBase<S>, S>
        : CompositeSelectionBuilder<Params['target'], S>
    ) => Items
  ): InsertBuilder<SetParams<Params, { returning: Items }, S>, S>;
  getSqlString(): SqlString;
  query(): Promise<
    undefined extends Params['returning']
      ? { sql: SqlString }
      : Params['values'] extends any[]
        ? {
            sql: SqlString;
            result: TableRecord<Params['target']['table'], S>[];
          }
        : Params['values'] extends ReadonlyArray<any>
          ? {
              sql: SqlString;
              result: {
                [Key in keyof Params['values']]: Params['values'][Key] extends InsertableValues<
                  TableBase<S>,
                  S
                >
                  ? TableRecord<Params['target']['table'], S>
                  : never;
              };
            }
          : Params['values'] extends InsertableValues<
                Params['target']['table'],
                S
              >
            ? {
                sql: SqlString;
                result: [TableRecord<Params['target']['table'], S>];
              }
            : never
  >;
}

export function createInsert<S extends BaseDbDiscriminator>(options: {
  query: DbConfig<S, any>['query'];
  discriminator: S;
}) {
  function insert<Target extends GenericEntityTarget<S>>(
    target: Target
  ): InsertBuilder<
    {
      target: {
        table: Target['Table'];
        alias: Target['Table']['defaultAlias'];
        isUsingAlias: true;
      };
      values: undefined;
      onConflict: undefined;
      returning: undefined;
      queryName: undefined;
    },
    S
  > {
    return baseInsert(target);
  }

  function baseInsert<Target extends GenericEntityTarget<S>>(
    target: Target,
    params: InsertParams<S> = {
      target: {
        table: target.Table,
        alias: target.Table.defaultAlias,
        isUsingAlias: true,
      },
      onConflict: undefined,
      returning: undefined,
      values: undefined,
      queryName: undefined,
    }
  ): InsertBuilder<any, S> {
    const targetBase: TargetBase<S> = {
      table: target.Table,
      alias: target.Table.defaultAlias,
      isUsingAlias: true,
    };
    return {
      setQueryName: (name: string) => {
        return baseInsert(target, {
          ...params,
          queryName: name,
        });
      },
      values: (values) => {
        return baseInsert(target, {
          ...params,
          values,
        });
      },
      onConflict: (options: {
        columns: (
          selector: CompositeSelectionBuilder<TargetBase<S>, S>
        ) => ExpressionBuilderShape<ExpressionColumn<any, string, S>>[];
        doNothing?: true;
        doUpdateSet?: DoUpdateSet<TableBase<S>, S>;
        where?: DoUpdateSetWhere<TargetBase<S>, S>;
      }) => {
        const columns = options.columns(
          createTableSelector([targetBase])[targetBase.alias]
        );
        if (options.doNothing) {
          return baseInsert(target, {
            ...params,
            onConflict: {
              columns: columns.map((val) => val._expression),
              doNothing: true,
            },
          });
        }

        if (options.doUpdateSet) {
          return baseInsert(target, {
            ...params,
            onConflict: {
              columns: columns.map((val) => val._expression),
              doUpdateSet: options.doUpdateSet,
              ...(options.where && {
                where: options.where(
                  createTableSelector([
                    targetBase,
                    {
                      table: targetBase.table,
                      alias: 'excluded',
                      join: { type: 'insert' },
                      isUsingAlias: true,
                    },
                  ])
                )._expression,
              }),
            },
          });
        }

        throw new Error(
          'Invalid onConflict options. Expected doNothing or doUpdateSet'
        );
      },
      returning: (
        returning:
          | '*'
          | ((
              selector: CompositeSelectionBuilder<TargetBase<S>, S>
            ) => ExpressionBuilderShape<ExpressionBase<any>>[])
      ) => {
        if (returning === '*') {
          return baseInsert(target, {
            ...params,
            returning: '*',
          });
        }

        const selector = createTableSelector([targetBase])[targetBase.alias];
        const items = returning(selector);
        return baseInsert(target, {
          ...params,
          returning: items,
        });
      },
      getSqlString() {
        return getInsertSqlQuery(params);
      },
      query: async () => {
        const sqlString = getInsertSqlQuery(params);

        const res = await options.query(
          params.queryName ?? '',
          getInsertSqlQuery(params),
          managerLocalStorage.getStore()?.manager
        );

        const transformedRes = res.map((item) => {
          return Object.fromEntries(
            Object.entries(item).map(([key, value]) => {
              const columnDataType =
                params.target.table.columnSchema[key]?.dataType;
              if (!columnDataType) {
                return [key, value];
              }

              const transformedColumn = transformColumnForDataType(
                value,
                columnDataType as DataTypes
              );

              return [key, transformedColumn];
            })
          );
        });

        return {
          sql: sqlString,
          result: transformedRes,
        };
      },
    };
  }

  return insert;
}

interface OnConflict<
  Params extends InsertParams<S>,
  S extends BaseDbDiscriminator,
> {
  <
    Columns extends ReadonlyArray<
      ExpressionBuilderShape<ExpressionColumn<Params['target'], string, S>>
    >,
  >(params: {
    columns: (
      selector: IsAny<Params> extends true
        ? CompositeSelectionBuilder<TargetBase<S>, S>
        : CompositeSelectionBuilder<Params['target'], S>
    ) => Columns;
    doNothing: true;
  }): InsertBuilder<
    SetParams<
      Params,
      {
        onConflict: {
          columns: ExpressionsFromBuilders<Columns>;
          doNothing: true;
        };
      },
      S
    >,
    S
  >;
  <
    Columns extends ReadonlyArray<
      ExpressionBuilderShape<ExpressionColumn<Params['target'], string, S>>
    >,
    UpdateSet extends DoUpdateSet<Params['target']['table'], S>,
  >(params: {
    columns: (
      selector: IsAny<Params> extends true
        ? CompositeSelectionBuilder<TargetBase<S>, S>
        : CompositeSelectionBuilder<Params['target'], S>
    ) => Columns;
    doUpdateSet: IsAny<Params> extends true
      ? DoUpdateSet<TableBase<S>, S>
      : UpdateSet;
    where?: DoUpdateSetWhere<Params['target'], S>;
  }): InsertBuilder<
    SetParams<
      Params,
      {
        onConflict: {
          columns: {
            [Column in keyof Columns]: Columns[Column] extends ExpressionBuilderShape<
              infer U
            >
              ? U
              : never;
          };
          doUpdateSet: {
            [UpdateSetItem in keyof UpdateSet]: UpdateSet[UpdateSetItem] extends ExpressionBuilderShape<
              infer U
            >
              ? U
              : UpdateSet[UpdateSetItem];
          };
        };
      },
      S
    >,
    S
  >;
}

function getInsertSqlQuery<S extends BaseDbDiscriminator>(
  params: InsertParams<S>
): SqlString {
  if (!params.values) {
    throw new Error('No values provided');
  }
  const target = params.target;

  const {
    values,
    keys,
  }: {
    values: SqlString;
    keys: SqlString;
  } = (() => {
    const values = Array.isArray(params.values)
      ? params.values
      : [params.values];

    if (!values.length) {
      throw new Error('No values provided');
    }

    const columns = Object.keys(target.table.columnSchema);
    const rows = values.map((value) => {
      return columns.map((key) => {
        const column = target.table.columnSchema[key];

        if (
          column.isOptionalForInsert &&
          (value[key] === undefined || value[key] === null)
        ) {
          return { key: key, value: undefined };
        }

        const result = serializeValueForDataType(
          key,
          value[key],
          column.dataType as (typeof allDataTypes)[number]
        );

        return { key, value: result };
      });
    });

    const allNullColumns = new Set(
      columns.filter((_key, index) => {
        return rows.every((row) => row[index].value === undefined);
      })
    );

    const finalRows = rows.map((row) => {
      return row
        .filter((val) => !allNullColumns.has(val.key))
        .map((column) => ({
          key: column.key,
          value: column.value ?? sql`NULL`,
        }));
    });

    const finalColumns = columns.filter((key) => !allNullColumns.has(key));

    return {
      keys: sql`(${sql.join(
        finalColumns.map((val) => sql.column({ name: val })),
        ','
      )})`,
      values: sql.join(
        finalRows.map(
          (val) =>
            sql`(${sql.join(
              val.map((column) => column.value),
              ','
            )})`
        ),
        ',\n'
      ),
    };
  })();

  const onConflict: SqlString = (() => {
    if (!params.onConflict) {
      return sql``;
    }

    const columns = params.onConflict.columns.map((column) =>
      sql.column({ name: column.value })
    );

    if ('doNothing' in params.onConflict) {
      return sql`ON CONFLICT (${sql.join(columns, ', ')}) DO NOTHING`;
    }

    const doUpdateSet = params.onConflict.doUpdateSet;
    const updateKeys = Object.keys(params.onConflict.doUpdateSet);

    if (!updateKeys.length) {
      throw new Error('No update keys provided for onConflict doUpdateSet');
    }

    const updateValues = updateKeys.map((key) => {
      const column = target.table.columnSchema[key];
      const value = doUpdateSet[key];

      if (typeof value === 'function') {
        const selector = createTableSelector([
          target,
          {
            table: target.table,
            alias: 'excluded',
            join: { type: 'insert' },
            isUsingAlias: true,
          },
        ]);

        const expr = value(selector)._expression;

        return getAstNodeRepository(expr).writeSql(expr, undefined);
      }

      return (
        serializeValueForDataType(
          key,
          doUpdateSet[key],
          column.dataType as (typeof allDataTypes)[number]
        ) ?? sql`NULL`
      );
    });

    const onConflictQuery = sql`ON CONFLICT (${sql.join(columns, ', ')}) DO UPDATE SET (
      ${sql.join(
        updateKeys.map((key) => sql.escapeIdentifier(key)),
        ', '
      )}
    ) = (${sql.join(updateValues, ', ')})`;

    if (!params.onConflict.where) {
      return onConflictQuery;
    }

    const whereClause = getAstNodeRepository(params.onConflict.where).writeSql(
      params.onConflict.where,
      undefined
    );

    return sql`${onConflictQuery} WHERE ${whereClause}`;
  })();

  const returning: SqlString = (() => {
    if (!params.returning) {
      return sql``;
    }

    if (params.returning === '*') {
      return sql`RETURNING *`;
    }

    const returningValues = params.returning.map((column) => {
      if (!expressionColumn.isNode(column._expression)) {
        throw new Error('Invalid returning value. Expected expression column');
      }

      return getAstNodeRepository(column._expression).writeSql(
        column._expression,
        undefined
      );
    });

    return sql`RETURNING ${sql.join(returningValues, ', ')}`;
  })();

  const query: SqlString = sql`
    INSERT INTO ${sql.table({ schema: target.table.schema, name: target.table.tableName, alias: target.alias })}
    ${keys} VALUES 
    ${values}
    ${onConflict}
    ${returning}
  `;

  return query;
}

export function serializeValueForDataType(
  columnName: string,
  value: any,
  dataType: (typeof allDataTypes)[number]
): SqlString | undefined {
  if (value === undefined || value === null) {
    if (isDataTypeNullable(dataType)) {
      return undefined;
    }

    throw new Error(
      `Column "${columnName}" is not nullable but no value was provided for value: ${JSON.stringify(value, undefined, 2)}`
    );
  }

  const finalDataType = getNonNullableDataType(dataType) as Exclude<
    (typeof allDataTypes)[number],
    { type: 'union' }
  >;

  switch (finalDataType.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(
          `Expected boolean for column "${columnName}", but received type "${typeof value[
            columnName
          ]}"`
        );
      }
      return value ? sql`TRUE` : sql`FALSE`;
    case 'float':
      if (typeof value !== 'number') {
        throw new Error(
          `Expected number for column "${columnName}", but received type "${typeof value[
            columnName
          ]}"`
        );
      }
      return sql.p(value);
    case 'int':
      if (typeof value !== 'number') {
        throw new Error(
          `Expected number for column "${columnName}", but received type "${typeof value[
            columnName
          ]}"`
        );
      }
      if (Math.round(value) !== value) {
        throw new Error(
          `Expected integer for column "${columnName}", but received "${value}"`
        );
      }
      return sql.p(value);
    case 'varchar': {
      if (typeof value !== 'string') {
        throw new Error(
          `Expected string for column "${columnName}", but received type "${typeof value}"`
        );
      }

      return sql.p(value);
    }
    case 'json': {
      if (typeof value !== 'object') {
        throw new Error(
          `Expected object for column "${columnName}", but received type "${typeof value[
            columnName
          ]}"`
        );
      }
      const asString = JSON.stringify(value);

      return sql`CAST(${sql.p(asString)} AS JSONB)`;
    }
    case 'timestamp': {
      const dateValue = value;
      if (!(dateValue instanceof Date)) {
        throw new Error(
          `Expected Date for column "${columnName}", but received type "${typeof value[
            columnName
          ]}"`
        );
      }

      return sql.p(dateValue);
    }
    case 'array': {
      const arrValue = value;
      if (!Array.isArray(arrValue)) {
        throw new Error(
          `Expected array for column "${columnName}", but received type "${typeof value[
            columnName
          ]}"`
        );
      }

      const arrayValues = arrValue.map((val) => {
        return (
          serializeValueForDataType('', val, finalDataType.primitiveDataType) ??
          sql`NULL`
        );
      });

      const arrayType: SqlString = (() => {
        const primitiveType = finalDataType.primitiveDataType
          .type as DataTypes['type'];

        switch (primitiveType) {
          case 'varchar':
            return sql`VARCHAR[]`;
          case 'int':
            return sql`INT[]`;
          case 'boolean':
            return sql`BOOLEAN[]`;
          case 'array':
            return sql`ARRAY[]`;
          case 'float':
            return sql`FLOAT[]`;
          case 'json':
            return sql`JSONB[]`;
          case 'timestamp':
            return sql`TIMESTAMP[]`;
          case 'tuple':
          case 'tabular_columns':
          case 'union':
            throw new Error(
              `Type ${primitiveType} is not supported for array types`
            );
          default:
            throw assertUnreachable(primitiveType);
        }
      })();

      return sql`ARRAY[${sql.join(arrayValues, ',')}]::${arrayType}`;
    }
    default:
      assertUnreachable(finalDataType);
  }
}

type DoUpdateSet<Table extends TableBase<S>, S extends BaseDbDiscriminator> = {
  [Key in keyof Table['columnSchema']]?:
    | TypescriptTypeFromDataType<
        IsAny<Table> extends true
          ? DataTypeBase
          : Table['columnSchema'][Key]['dataType']
      >
    | ((
        selector: TableSelector<
          [
            {
              table: IsAny<Table> extends true ? TableBase<S> : Table;
              alias: Table['defaultAlias'];
              isUsingAlias: true;
            },
            {
              table: IsAny<Table> extends true ? TableBase<S> : Table;
              alias: 'excluded';
              join: { type: 'insert' };
              isUsingAlias: true;
            },
          ],
          S
        >
      ) => ExpressionBuilderShape<
        ExpressionBase<Table['columnSchema'][Key]['dataType']>
      >);
};

export type DoUpdateSetWhere<
  Target extends TargetBase<S>,
  S extends BaseDbDiscriminator,
> = (
  selector: TableSelector<
    [
      Target,
      {
        table: Target['table'];
        alias: 'excluded';
        join: { type: 'insert' };
        isUsingAlias: true;
      },
    ],
    S
  >
) => ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>;

type ExpressionsFromBuilders<
  T extends ReadonlyArray<ExpressionBuilderShape<any>>,
> = {
  [Key in keyof T]: T[Key] extends ExpressionBuilderShape<infer U> ? U : never;
};
