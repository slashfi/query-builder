import type { AllOf, AnyOf, Expand, IsAny, TypecheckError } from '@/core-utils';
import { getAstNodeRepository } from './ast-node-repository';
import type { BaseDbDiscriminator, ExpressionBase, TableBase } from './base';
import type { DataTypeBoolean, DataTypes, allDataTypes } from './data-type';
import type { DbConfig } from './db-helper';
import type { GenericEntityTarget } from './entity-target';
import type { ExpressionBuilderShape } from './expression-builder-type';
import type { ExpressionColumn } from './expressions/expression-column';
import type { TargetBase } from './from-builder';
import { serializeValueForDataType } from './insert-builder';
import { getSqlForColumnExpressionForDataType } from './migrations/column-expression-for-data-type';
import { transformColumnForDataType } from './query-result';
import { managerLocalStorage } from './run-in-transaction';
import { type SqlString, sql } from './sql-string';
import { type TableSelector, createTableSelector } from './table-selector';

interface UpdateParams<S extends BaseDbDiscriminator> {
  target: TargetBase<S>;
  fieldMappings:
    | {
        [Key in string]: ExpressionBuilderShape<
          ExpressionColumn<TargetBase<S>, Key, S>
        >;
      }
    | undefined;
  values: Record<string, any>[] | undefined;
  where: ExpressionBase<DataTypeBoolean> | undefined;
  returning: '*' | undefined;
  queryName: string | undefined;
}

type SetParams<
  Params extends UpdateParams<S>,
  Update extends Partial<UpdateParams<S>>,
  S extends BaseDbDiscriminator,
> = IsAny<Params> extends true
  ? Params
  : Omit<Params, keyof Update> & Update extends infer U extends UpdateParams<S>
    ? Expand<U>
    : never;

type UpdateTargetList<
  T extends TableBase<S>,
  Fields extends string,
  S extends BaseDbDiscriminator,
> = [
  {
    table: T;
    alias: T['defaultAlias'];
    isUsingAlias: true;
  },
  {
    table: Omit<T, 'columnSchema'> & {
      columnSchema: Pick<T['columnSchema'], Fields>;
    } extends infer U extends TableBase<S>
      ? U
      : never;
    alias: 'values';
    isUsingAlias: true;
  },
];

type UpdateResult<
  Params extends UpdateParams<S>,
  S extends BaseDbDiscriminator,
> = undefined extends Params['returning'] ? void : Record<string, any>[];

type ThenableUpdateResult<
  Params extends UpdateParams<S>,
  S extends BaseDbDiscriminator,
> = AllOf<
  [
    Params['values'] extends Record<string, any>[] ? true : false,
    Params['where'] extends ExpressionBase<DataTypeBoolean> ? true : false,
    Params['fieldMappings'] extends Record<string, ExpressionBuilderShape<any>>
      ? true
      : false,
  ]
> extends true
  ? PromiseLike<UpdateResult<Params, S>>
  : {};

export type UpdateBuilder<
  Params extends UpdateParams<S>,
  S extends BaseDbDiscriminator,
> = ThenableUpdateResult<Params, S> & UpdateBuilderBase<Params, S>;

interface UpdateBuilderBase<
  Params extends UpdateParams<S>,
  S extends BaseDbDiscriminator,
> {
  setQueryName: (
    queryName: string
  ) => UpdateBuilder<SetParams<Params, { queryName: string }, S>, S>;

  setFields: <
    NewFields extends ReadonlyArray<
      ExpressionBuilderShape<ExpressionColumn<Params['target'], string, S>>
    >,
  >(
    fn: (selector: TableSelector<[Params['target']], S>) => NewFields
  ) => UpdateBuilder<
    SetParams<
      Params,
      {
        fieldMappings: {
          [Key in NewFields[number]['_expression']['value']]: ExpressionBuilderShape<
            Extract<
              NewFields[number],
              { _expression: { value: Key } }
            >['_expression']
          >;
        };
      },
      S
    >,
    S
  >;

  values: AnyOf<
    [
      Params['fieldMappings'] extends Record<string, any> ? true : false,
      IsAny<Params>,
    ]
  > extends true
    ? (
        ...values: {
          [Key in keyof Params['fieldMappings']]: NonNullable<
            Params['fieldMappings']
          >[Key]['_expression']['dataType']['narrowedType'];
        }[]
      ) => UpdateBuilder<
        SetParams<
          Params,
          {
            values: {
              [Key in keyof Params['fieldMappings']]: NonNullable<
                Params['fieldMappings']
              >[Key]['_expression']['dataType']['narrowedType'];
            }[];
          },
          S
        >,
        S
      >
    : TypecheckError<'Must specify setField before using values', {}>;

  where: AnyOf<
    [
      IsAny<Params>,
      Params['fieldMappings'] extends Record<string, any> ? true : false,
      Params['values'] extends Record<string, any>[] ? true : false,
    ]
  > extends true
    ? (
        fn: (
          selector: TableSelector<
            UpdateTargetList<
              Params['target']['table'],
              Extract<keyof Params['fieldMappings'], string>,
              S
            >,
            S
          >
        ) => ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
      ) => UpdateBuilder<
        SetParams<Params, { where: ExpressionBase<DataTypeBoolean> }, S>,
        S
      >
    : TypecheckError<
        'Must specify values and setField before specifying a where clause',
        {}
      >;

  returning(): UpdateBuilder<SetParams<Params, { returning: '*' }, S>, S>;

  getSqlString(): SqlString;
}

export function createUpdate<S extends BaseDbDiscriminator>(config: {
  query: DbConfig<S, any>['query'];
  discriminator: S;
}) {
  function update<Target extends GenericEntityTarget<S>>(
    target: Target
  ): UpdateBuilder<
    {
      target: {
        table: Target['Table'];
        alias: Target['Table']['defaultAlias'];
        isUsingAlias: true;
      };
      fieldMappings: undefined;
      values: undefined;
      where: undefined;
      returning: undefined;
      queryName: undefined;
    },
    S
  > {
    return baseUpdate(target) as unknown as UpdateBuilder<
      {
        target: {
          table: Target['Table'];
          alias: Target['Table']['defaultAlias'];
          isUsingAlias: true;
        };
        fieldMappings: undefined;
        values: undefined;
        where: undefined;
        returning: undefined;
        queryName: undefined;
      },
      S
    >;
  }

  function baseUpdate<Target extends GenericEntityTarget<S>>(
    target: Target,
    params: UpdateParams<S> = {
      target: {
        table: target.Table,
        alias: target.Table.defaultAlias,
        isUsingAlias: true,
      },
      fieldMappings: undefined,
      values: undefined,
      where: undefined,
      returning: undefined,
      queryName: undefined,
    }
  ): UpdateBuilder<any, S> {
    const targetBase: TargetBase<S> = {
      table: target.Table,
      alias: target.Table.defaultAlias,
      isUsingAlias: true,
    };

    const builder = {
      setQueryName: (name: string) => {
        return baseUpdate(target, {
          ...params,
          queryName: name,
        });
      },

      setFields: (fn) => {
        const selector: TableSelector<[TargetBase<S>], S> = createTableSelector(
          [{ ...targetBase, isUsingAlias: true }]
        );
        const arr = fn(selector);
        return baseUpdate(target, {
          ...params,
          fieldMappings: Object.fromEntries(
            arr.map((shape) => {
              return [shape._expression.value, shape];
            })
          ),
        });
      },

      values: (...values) => {
        return baseUpdate(target, {
          ...params,
          values,
        });
      },

      where: (fn) => {
        const targets: UpdateTargetList<typeof target.Table, any, S> = [
          { ...targetBase, isUsingAlias: true },
          { ...targetBase, alias: 'values', isUsingAlias: true },
        ];
        const selector = createTableSelector(targets);
        return baseUpdate(target, {
          ...params,
          where: fn(selector)._expression,
        });
      },

      returning: () => {
        return baseUpdate(target, {
          ...params,
          returning: '*',
        });
      },

      getSqlString() {
        return getUpdateSqlQuery(params);
      },

      // biome-ignore lint/suspicious/noThenProperty: <explanation>
      then<TResult1 = UpdateResult<typeof params, S>, TResult2 = never>(
        onfulfilled?:
          | ((
              value: UpdateResult<typeof params, S>
            ) => TResult1 | PromiseLike<TResult1>)
          | undefined
          | null,
        onrejected?:
          | ((reason: any) => TResult2 | PromiseLike<TResult2>)
          | undefined
          | null
      ): Promise<TResult1 | TResult2> {
        if (!params.fieldMappings || !params.values || !params.where) {
          throw new Error(
            'Cannot await query until setFieldsForValues, values, and where are all called'
          );
        }

        const sqlString = getUpdateSqlQuery(params);

        return config
          .query(
            params.queryName ?? '',
            sqlString,
            managerLocalStorage.getStore()?.manager
          )
          .then((res) => {
            if (!params.returning) {
              return onfulfilled ? onfulfilled() : (void 0 as TResult1);
            }

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

            return onfulfilled
              ? onfulfilled(transformedRes as any)
              : (transformedRes as TResult1);
          })
          .catch(onrejected);
      },
    } as UpdateBuilder<any, S>;

    return builder;
  }

  return update;
}

function getUpdateSqlQuery<S extends BaseDbDiscriminator>(
  params: UpdateParams<S>
): SqlString {
  if (!params.fieldMappings || !params.values || !params.where) {
    throw new Error(
      'Cannot generate SQL until setFieldsForValues, values, and where are all called'
    );
  }

  const target = params.target;
  const updateColumns = Object.keys(params.fieldMappings);

  if (!updateColumns.length) {
    throw new Error('No columns to update');
  }

  const fields = updateColumns;
  const schemas = params.values;

  const setClause = sql`(
    ${sql.join(
      fields.map((field) => sql.column({ name: field })),
      ','
    )}
  ) = (
    ${sql.join(
      fields.map((field) => sql.column({ name: field, table: 'values' })),
      ','
    )}
  )`;

  const valuesClause = sql` FROM (
    SELECT
      ${sql.join(
        fields.map(
          (field, index) =>
            sql`column${sql([`${index + 1}`])} as ${sql.column({ name: field })}`
        ),
        ','
      )}
    FROM (
      VALUES
        ${sql.join(
          schemas.map((schema) => {
            const values = fields.map((field) => {
              const value = schema[field];

              const columnDataType =
                target.table.columnSchema?.[field]?.dataType;

              if (!columnDataType) {
                throw new Error(`No column data type found for ${field}`);
              }

              const serializedValue = serializeValueForDataType(
                field,
                value,
                columnDataType as (typeof allDataTypes)[number]
              );

              if (serializedValue === undefined) {
                return sql`NULL`;
              }

              const dataType = getSqlForColumnExpressionForDataType(
                columnDataType,
                { defaultValue: undefined, includeNotNullSuffix: false }
              );

              return sql`CAST(${serializedValue} AS ${dataType})`;
            });

            return sql`(${sql.join(values, ',')})`;
          }),
          ','
        )}
    )
  ) as "values"`;

  const whereClause = sql` WHERE ${getAstNodeRepository(params.where).writeSql(
    params.where,
    undefined
  )}`;

  const returning = params.returning ? sql` RETURNING *` : sql``;

  return sql`
    UPDATE ${sql.table({ name: target.table.tableName, schema: target.table.schema })} AS ${sql.table({ name: target.alias })}
    SET ${setClause}${valuesClause}${whereClause}${returning}
  `;
}
